import uuid
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.cart import Cart
from app.models.message import Message
from app.models.rental_request import RentalRequest, RequestStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.schemas.cart import RentalRequestCreate, RentalRequestDirectReserve, RentalRequestFormalize, RentalRequestResponse, RentalRequestUpdate
from app.services import notification_service

router = APIRouter(prefix="/rental-requests", tags=["rental-requests"])


def _to_response(
    r: RentalRequest,
    reservation_status: str | None = None,
    last_message_body: str | None = None,
    last_message_at: datetime | None = None,
    unread_count: int = 0,
) -> RentalRequestResponse:
    return RentalRequestResponse(
        id=r.id,
        cart_id=r.cart_id,
        renter_id=r.renter_id,
        quantity=r.quantity,
        start_date=r.start_date,
        end_date=r.end_date,
        message=r.message,
        status=r.status,
        created_at=r.created_at,
        cart_title=r.cart.title if r.cart else None,
        renter_name=r.renter.display_name if r.renter else None,
        lender_name=r.cart.owner.display_name if r.cart and r.cart.owner else None,
        station_name=r.cart.station.name if r.cart and r.cart.station else None,
        municipality=r.cart.station.municipality if r.cart and r.cart.station else None,
        lending_address=r.cart.lending_address if r.cart else None,
        reservation_status=reservation_status,
        last_message_body=last_message_body,
        last_message_at=last_message_at,
        unread_count=unread_count,
    )


async def _get_request_or_404(request_id: int, db: AsyncSession) -> RentalRequest:
    result = await db.execute(
        select(RentalRequest)
        .options(
            selectinload(RentalRequest.cart).selectinload(Cart.station),
            selectinload(RentalRequest.cart).selectinload(Cart.owner),
            selectinload(RentalRequest.renter),
        )
        .where(RentalRequest.id == request_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return r


@router.get("", response_model=list[RentalRequestResponse])
async def list_requests(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[RentalRequestResponse]:
    uid = uuid.UUID(user_id)
    stmt = (
        select(RentalRequest)
        .options(
            selectinload(RentalRequest.cart).selectinload(Cart.station),
            selectinload(RentalRequest.cart).selectinload(Cart.owner),
            selectinload(RentalRequest.renter),
        )
        .join(Cart)
        .where((RentalRequest.renter_id == uid) | (Cart.owner_id == uid))
        .order_by(RentalRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    requests = result.scalars().all()

    if not requests:
        return []

    req_ids = [r.id for r in requests]

    # メッセージを一括取得してスレッドサマリーを計算
    msgs_result = await db.execute(
        select(Message)
        .where(Message.rental_request_id.in_(req_ids))
        .order_by(Message.created_at.asc())
    )
    all_msgs = msgs_result.scalars().all()

    last_msg: dict[int, Message] = {}
    unread: dict[int, int] = defaultdict(int)
    for m in all_msgs:
        last_msg[m.rental_request_id] = m
        if not m.is_read and m.sender_id != uid:
            unread[m.rental_request_id] += 1

    # 予約ステータスを一括取得（accepted なリクエストのみ）
    res_status: dict[int, str] = {}
    accepted_ids = [r.id for r in requests if r.status == RequestStatus.accepted]
    if accepted_ids:
        res_rows = await db.execute(
            select(Reservation.rental_request_id, Reservation.status)
            .where(Reservation.rental_request_id.in_(accepted_ids))
        )
        res_status = {row[0]: row[1].value for row in res_rows}

    return [
        _to_response(
            r,
            reservation_status=res_status.get(r.id),
            last_message_body=last_msg[r.id].body if r.id in last_msg else None,
            last_message_at=last_msg[r.id].created_at if r.id in last_msg else None,
            unread_count=unread[r.id],
        )
        for r in requests
    ]


@router.get("/{request_id}", response_model=RentalRequestResponse)
async def get_request(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RentalRequestResponse:
    r = await _get_request_or_404(request_id, db)
    uid = uuid.UUID(user_id)
    if r.renter_id != uid and r.cart.owner_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return _to_response(r)


@router.post("", response_model=RentalRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    body: RentalRequestCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RentalRequestResponse:
    cart_result = await db.execute(select(Cart).where(Cart.id == body.cart_id))
    cart = cart_result.scalar_one_or_none()
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    if str(cart.owner_id) == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot request your own cart")

    is_inquiry = body.start_date is None or body.end_date is None
    req_status = RequestStatus.inquiry if is_inquiry else RequestStatus.pending

    r = RentalRequest(
        renter_id=uuid.UUID(user_id),
        cart_id=body.cart_id,
        quantity=body.quantity,
        start_date=body.start_date,
        end_date=body.end_date,
        message=body.message,
        status=req_status,
    )
    db.add(r)
    await db.flush()

    # 最初のメッセージを追加（inquiry の場合はメッセージ本文をチャットに流す）
    if body.message and is_inquiry:
        db.add(Message(
            rental_request_id=r.id,
            sender_id=uuid.UUID(user_id),
            body=body.message,
            is_system=False,
        ))

    await db.commit()
    r = await _get_request_or_404(r.id, db)

    renter_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    renter = renter_result.scalar_one_or_none()
    renter_name = renter.display_name if renter else "借主"

    if is_inquiry:
        # 貸主へ問い合わせ通知
        await notification_service.notify_inquiry_received(db, r.cart.owner_id, renter_name, r.id)
    else:
        # 貸主へリクエスト通知
        await notification_service.notify_request_received(db, r.cart.owner_id, renter_name, r.id)
    await db.commit()
    return _to_response(r)


@router.post("/{request_id}/formalize", response_model=RentalRequestResponse)
async def formalize_request(
    request_id: int,
    body: RentalRequestFormalize,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RentalRequestResponse:
    """借主: inquiry → pending（日程を確定してリクエスト送信）"""
    r = await _get_request_or_404(request_id, db)
    if str(r.renter_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only renter can formalize")
    if r.status != RequestStatus.inquiry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not an inquiry")

    r.start_date = body.start_date
    r.end_date = body.end_date
    r.quantity = body.quantity
    r.status = RequestStatus.pending

    fmt = lambda d: d.strftime("%-m/%-d %-H:%M")
    db.add(Message(
        rental_request_id=r.id,
        sender_id=r.renter_id,
        body=f"予約リクエストを送信しました。\n貸出: {fmt(body.start_date)}\n返却: {fmt(body.end_date)}\n台数: {body.quantity}台",
        is_system=True,
    ))

    renter_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    renter = renter_result.scalar_one_or_none()
    await notification_service.notify_request_received(
        db, r.cart.owner_id, renter.display_name or "借主", r.id
    )
    await db.commit()
    return _to_response(r)


@router.post("/{request_id}/direct-reserve", response_model=RentalRequestResponse)
async def direct_reserve(
    request_id: int,
    body: RentalRequestDirectReserve,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RentalRequestResponse:
    """貸主: inquiry → accepted + 予約確定（reserved）"""
    r = await _get_request_or_404(request_id, db)
    if str(r.cart.owner_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only cart owner can direct reserve")
    if r.status not in (RequestStatus.inquiry, RequestStatus.pending):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request cannot be direct reserved")

    r.start_date = body.start_date
    r.end_date = body.end_date
    r.quantity = body.quantity
    r.status = RequestStatus.accepted

    confirmed_rate = r.cart.daily_rate or r.cart.per_rental_rate or r.cart.weekly_rate or 0
    reservation = Reservation(
        rental_request_id=r.id,
        lender_id=r.cart.owner_id,
        renter_id=r.renter_id,
        start_date=body.start_date,
        end_date=body.end_date,
        quantity=body.quantity,
        daily_rate=confirmed_rate,
        status=ReservationStatus.reserved,
    )
    db.add(reservation)

    fmt = lambda d: d.strftime("%-m/%-d %-H:%M")
    db.add(Message(
        rental_request_id=r.id,
        sender_id=r.cart.owner_id,
        body=f"予約が確定しました。\n貸出: {fmt(body.start_date)}\n返却: {fmt(body.end_date)}\n台数: {body.quantity}台",
        is_system=True,
    ))

    lender_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    lender = lender_result.scalar_one_or_none()
    await notification_service.notify_request_accepted(
        db, r.renter_id, lender.display_name or "貸主", r.id
    )
    await db.commit()
    return _to_response(r)


@router.patch("/{request_id}", response_model=RentalRequestResponse)
async def update_request(
    request_id: int,
    body: RentalRequestUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RentalRequestResponse:
    r = await _get_request_or_404(request_id, db)
    if str(r.cart.owner_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only cart owner can edit")
    if r.status != RequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    # 変更前の値を保存
    fmt = lambda d: d.strftime("%-m/%-d %-H:%M") if d else "-"
    changes: list[str] = []
    if body.start_date is not None and body.start_date != r.start_date:
        changes.append(f"貸出日時: {fmt(r.start_date)} → {fmt(body.start_date)}")
        r.start_date = body.start_date
    if body.end_date is not None and body.end_date != r.end_date:
        changes.append(f"返却日時: {fmt(r.end_date)} → {fmt(body.end_date)}")
        r.end_date = body.end_date
    if body.quantity is not None and body.quantity != r.quantity:
        changes.append(f"台数: {r.quantity}台 → {body.quantity}台")
        r.quantity = body.quantity
    if body.message is not None:
        r.message = body.message

    lender_name = r.cart.owner.display_name if r.cart and r.cart.owner else "貸す人"
    change_text = "\n".join(changes) if changes else "（変更なし）"
    system_body = f"{lender_name}さんがリクエスト内容を変更しました。\n{change_text}"

    db.add(Message(
        rental_request_id=r.id,
        sender_id=r.cart.owner_id,
        body=system_body,
        is_system=True,
    ))
    await db.commit()
    return _to_response(r)


@router.post("/{request_id}/accept", response_model=RentalRequestResponse)
async def accept_request(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RentalRequestResponse:
    r = await _get_request_or_404(request_id, db)
    if str(r.cart.owner_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only cart owner can accept")
    if r.status != RequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")
    r.status = RequestStatus.accepted
    # 予約を自動作成
    confirmed_rate = r.cart.daily_rate or r.cart.per_rental_rate or r.cart.weekly_rate or 0
    reservation = Reservation(
        rental_request_id=r.id,
        lender_id=r.cart.owner_id,
        renter_id=r.renter_id,
        start_date=r.start_date,
        end_date=r.end_date,
        quantity=r.quantity,
        daily_rate=confirmed_rate,
    )
    db.add(reservation)
    # システムメッセージを追加
    db.add(Message(
        rental_request_id=r.id,
        sender_id=r.cart.owner_id,
        body="リクエストが承認されました。",
        is_system=True,
    ))
    # 借主へ承認通知
    lender_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    lender = lender_result.scalar_one_or_none()
    await notification_service.notify_request_accepted(
        db, r.renter_id, lender.display_name or "貸主", r.id
    )
    await db.commit()
    return _to_response(r)


@router.post("/{request_id}/reject", response_model=RentalRequestResponse)
async def reject_request(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RentalRequestResponse:
    r = await _get_request_or_404(request_id, db)
    if str(r.cart.owner_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only cart owner can reject")
    if r.status != RequestStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")
    r.status = RequestStatus.rejected
    lender_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    lender = lender_result.scalar_one_or_none()
    await notification_service.notify_request_rejected(
        db, r.renter_id, lender.display_name or "貸主", r.id
    )
    await db.commit()
    return _to_response(r)


@router.post("/{request_id}/cancel", response_model=RentalRequestResponse)
async def cancel_request(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RentalRequestResponse:
    r = await _get_request_or_404(request_id, db)
    if str(r.cart.owner_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only lender can cancel")
    if r.status not in (RequestStatus.pending, RequestStatus.accepted):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel")
    r.status = RequestStatus.cancelled
    lender_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    lender = lender_result.scalar_one_or_none()
    await notification_service.notify_request_cancelled(
        db, r.renter_id, lender.display_name or "貸主", r.id
    )
    await db.commit()
    return _to_response(r)
