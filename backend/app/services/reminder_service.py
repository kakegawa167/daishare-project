"""
貸出・返却リマインド通知バッチ（60分前）
APScheduler で main.py の lifespan から起動する。
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.notification import Notification, NotificationType
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.services.notification_service import _send_expo_push


async def _send_reminder(user_id, title: str, body: str, related_id: int, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return
    notif = Notification(
        user_id=user_id,
        type=NotificationType.reminder_lend_start if "貸出" in title else NotificationType.reminder_return,
        title=title,
        body=body,
        related_id=related_id,
    )
    db.add(notif)
    if user.push_token:
        await _send_expo_push(user.push_token, title, body)


async def run_reminders() -> None:
    """60分以内に開始・終了する予約を対象にリマインドを送る（重複送信防ぐため通知チェックなし・簡易実装）"""
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(minutes=55)
    window_end = now + timedelta(minutes=65)

    async with async_session_factory() as db:
        # 貸出開始リマインド（reserved → まだ lent になっていない）
        result = await db.execute(
            select(Reservation).where(
                Reservation.status == ReservationStatus.reserved,
                Reservation.start_date >= window_start,
                Reservation.start_date <= window_end,
            )
        )
        for r in result.scalars().all():
            await _send_reminder(r.lender_id, "貸出開始60分前", "もうすぐ貸出開始時間です。準備をお願いします。", r.id, db)
            await _send_reminder(r.renter_id, "貸出開始60分前", "もうすぐ台車の受取時間です。", r.id, db)

        # 返却リマインド（lent）
        result = await db.execute(
            select(Reservation).where(
                Reservation.status == ReservationStatus.lent,
                Reservation.end_date >= window_start,
                Reservation.end_date <= window_end,
            )
        )
        for r in result.scalars().all():
            await _send_reminder(r.lender_id, "返却60分前", "もうすぐ返却時間です。", r.id, db)
            await _send_reminder(r.renter_id, "返却60分前", "もうすぐ台車の返却時間です。", r.id, db)

        await db.commit()
