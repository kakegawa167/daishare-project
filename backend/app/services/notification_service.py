"""
通知作成 + Expo Push 送信サービス。
各APIエンドポイントから呼び出す。
"""

import uuid
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.models.user import User
from sqlalchemy import select

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _send_expo_push(token: str, title: str, body: str, data: dict[str, Any] | None = None) -> None:
    if not token or not token.startswith("ExponentPushToken"):
        return
    payload = {"to": token, "title": title, "body": body, "sound": "default"}
    if data:
        payload["data"] = data
    async with httpx.AsyncClient() as client:
        await client.post(EXPO_PUSH_URL, json=payload, timeout=5.0)


async def _create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    ntype: NotificationType,
    title: str,
    body: str,
    related_id: int | None = None,
) -> None:
    notif = Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        body=body,
        related_id=related_id,
    )
    db.add(notif)
    # push tokenを取得して送信
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user and user.expo_push_token:
        await _send_expo_push(user.expo_push_token, title, body, {"related_id": related_id, "type": ntype.value})


async def notify_request_received(db: AsyncSession, lender_id: uuid.UUID, renter_name: str, request_id: int) -> None:
    await _create_notification(
        db, lender_id,
        NotificationType.request_received,
        "リクエストが届きました",
        f"{renter_name}さんからレンタルリクエストが届きました",
        related_id=request_id,
    )


async def notify_request_accepted(db: AsyncSession, renter_id: uuid.UUID, lender_name: str, request_id: int) -> None:
    await _create_notification(
        db, renter_id,
        NotificationType.request_accepted,
        "リクエストが承認されました",
        f"{lender_name}さんがリクエストを承認しました",
        related_id=request_id,
    )


async def notify_request_rejected(db: AsyncSession, renter_id: uuid.UUID, lender_name: str, request_id: int) -> None:
    await _create_notification(
        db, renter_id,
        NotificationType.request_rejected,
        "リクエストが拒否されました",
        f"{lender_name}さんがリクエストを拒否しました",
        related_id=request_id,
    )


async def notify_request_cancelled(db: AsyncSession, other_id: uuid.UUID, canceller_name: str, request_id: int) -> None:
    await _create_notification(
        db, other_id,
        NotificationType.request_cancelled,
        "リクエストがキャンセルされました",
        f"{canceller_name}さんがリクエストをキャンセルしました",
        related_id=request_id,
    )


async def notify_message_received(db: AsyncSession, recipient_id: uuid.UUID, sender_name: str, request_id: int) -> None:
    await _create_notification(
        db, recipient_id,
        NotificationType.message_received,
        "メッセージが届きました",
        f"{sender_name}さんからメッセージが届きました",
        related_id=request_id,
    )


async def notify_lend_started(db: AsyncSession, renter_id: uuid.UUID, reservation_id: int) -> None:
    await _create_notification(
        db, renter_id,
        NotificationType.lend_started,
        "貸出が開始されました",
        "台車の貸出が開始されました。ご確認ください。",
        related_id=reservation_id,
    )


async def notify_returned(db: AsyncSession, lender_id: uuid.UUID, reservation_id: int) -> None:
    await _create_notification(
        db, lender_id,
        NotificationType.returned,
        "返却が完了しました",
        "台車が返却されました。レビューを書きましょう。",
        related_id=reservation_id,
    )


async def notify_review_received(db: AsyncSession, reviewee_id: uuid.UUID, reviewer_name: str, reservation_id: int) -> None:
    await _create_notification(
        db, reviewee_id,
        NotificationType.review_received,
        "レビューが届きました",
        f"{reviewer_name}さんからレビューが届きました",
        related_id=reservation_id,
    )
