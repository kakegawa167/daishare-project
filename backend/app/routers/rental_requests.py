import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.cart import Cart
from app.models.message import Message
from app.models.rental_request import RentalRequest, RequestStatus
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.cart import RentalRequestCreate, RentalRequestResponse
from app.services import notification_service

router = APIRouter(prefix="/rental-requests", tags=["rental-requests"])


def _to_response(r: RentalRequest) -> RentalRequestResponse:
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
    )


async def _get_request_or_404(request_id: int, db: AsyncSession) -> RentalRequest:
    result = await db.execute(
        select(RentalRequest)
        .options(selectinload(RentalRequest.cart), selectinload(RentalRequest.renter))
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
    # 自分が借主のリクエスト、または自分の台車へのリクエスト
    stmt = (
        select(RentalRequest)
        .options(selectinload(RentalRequest.cart), selectinload(RentalRequest.renter))
        .join(Cart)
        .where((RentalRequest.renter_id == uid) | (Cart.owner_id == uid))
        .order_by(RentalRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    return [_to_response(r) for r in result.scalars().all()]


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

    r = RentalRequest(renter_id=uuid.UUID(user_id), **body.model_dump())
    db.add(r)
    await db.commit()
    r = await _get_request_or_404(r.id, db)
    # 貸主へ通知
    renter_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    renter = renter_result.scalar_one_or_none()
    await notification_service.notify_request_received(
        db, r.cart.owner_id, renter.display_name or "借主", r.id
    )
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
    reservation = Reservation(
        rental_request_id=r.id,
        lender_id=r.cart.owner_id,
        renter_id=r.renter_id,
        start_date=r.start_date,
        end_date=r.end_date,
        quantity=r.quantity,
        daily_rate=r.cart.daily_rate,
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
    if str(r.renter_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only renter can cancel")
    if r.status not in (RequestStatus.pending, RequestStatus.accepted):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel")
    r.status = RequestStatus.cancelled
    renter_result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    renter = renter_result.scalar_one_or_none()
    await notification_service.notify_request_cancelled(
        db, r.cart.owner_id, renter.display_name or "借主", r.id
    )
    await db.commit()
    return _to_response(r)
