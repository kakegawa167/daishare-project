import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.cart import Cart
from app.models.message import Message
from app.models.rental_request import RentalRequest
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User
from app.schemas.message import ReservationResponse
from app.services import notification_service

router = APIRouter(prefix="/reservations", tags=["reservations"])


_EAGER = [
    selectinload(Reservation.lender),
    selectinload(Reservation.renter),
    selectinload(Reservation.rental_request).selectinload(RentalRequest.cart).selectinload(Cart.station),
]


def _to_response(r: Reservation) -> ReservationResponse:
    cart = r.rental_request.cart if r.rental_request else None
    station = cart.station if cart else None
    return ReservationResponse(
        id=r.id,
        rental_request_id=r.rental_request_id,
        lender_id=r.lender_id,
        renter_id=r.renter_id,
        start_date=r.start_date,
        end_date=r.end_date,
        quantity=r.quantity,
        daily_rate=float(r.daily_rate),
        lent_at=r.lent_at,
        returned_at=r.returned_at,
        note=r.note,
        status=r.status,
        created_at=r.created_at,
        lender_name=r.lender.display_name if r.lender else None,
        renter_name=r.renter.display_name if r.renter else None,
        cart_title=cart.title if cart else None,
        station_name=station.name if station else None,
        municipality=station.municipality if station else None,
        lending_address=cart.lending_address if cart else None,
    )


async def _get_reservation(reservation_id: int, db: AsyncSession) -> Reservation:
    result = await db.execute(
        select(Reservation).options(*_EAGER).where(Reservation.id == reservation_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return r


@router.get("", response_model=list[ReservationResponse])
async def list_reservations(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ReservationResponse]:
    uid = uuid.UUID(user_id)
    result = await db.execute(
        select(Reservation)
        .options(*_EAGER)
        .where((Reservation.lender_id == uid) | (Reservation.renter_id == uid))
        .order_by(Reservation.start_date.asc())
    )
    return [_to_response(r) for r in result.scalars().all()]


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReservationResponse:
    r = await _get_reservation(reservation_id, db)
    uid = uuid.UUID(user_id)
    if r.lender_id != uid and r.renter_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return _to_response(r)


@router.post("/{reservation_id}/lend", response_model=ReservationResponse)
async def start_lend(
    reservation_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReservationResponse:
    r = await _get_reservation(reservation_id, db)
    if str(r.lender_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only lender can start lending")
    if r.status != ReservationStatus.reserved:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reservation is not in reserved status")
    r.status = ReservationStatus.lent
    r.lent_at = datetime.now(timezone.utc)
    db.add(Message(
        rental_request_id=r.rental_request_id,
        sender_id=r.lender_id,
        body="貸出が開始されました。",
        is_system=True,
    ))
    lender_result = await db.execute(select(User).where(User.id == r.lender_id))
    lender = lender_result.scalar_one_or_none()
    lender_name = lender.display_name or "貸主" if lender else "貸主"
    await notification_service.notify_lend_started(db, r.renter_id, lender_name, r.id)
    await db.commit()
    return _to_response(r)


@router.post("/{reservation_id}/return", response_model=ReservationResponse)
async def complete_return(
    reservation_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReservationResponse:
    r = await _get_reservation(reservation_id, db)
    if str(r.lender_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only lender can complete return")
    if r.status != ReservationStatus.lent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reservation is not in lent status")
    r.status = ReservationStatus.returned
    r.returned_at = datetime.now(timezone.utc)
    db.add(Message(
        rental_request_id=r.rental_request_id,
        sender_id=r.lender_id,
        body="返却が完了しました。",
        is_system=True,
    ))
    lender_result = await db.execute(select(User).where(User.id == r.lender_id))
    lender = lender_result.scalar_one_or_none()
    lender_name = lender.display_name or "貸主" if lender else "貸主"
    await notification_service.notify_returned(db, r.renter_id, lender_name, r.id)
    await db.commit()
    return _to_response(r)


@router.patch("/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    reservation_id: int,
    body: dict,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReservationResponse:
    r = await _get_reservation(reservation_id, db)
    if str(r.lender_id) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only lender can update reservation")
    if r.status != ReservationStatus.lent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only update reservation in lent status")
    if "end_date" in body:
        new_end = datetime.fromisoformat(body["end_date"].replace("Z", "+00:00"))
        if new_end <= r.start_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_date must be after start_date")
        old_end = r.end_date.strftime("%-m/%-d %-H:%M") if r.end_date else "-"
        r.end_date = new_end
        db.add(Message(
            rental_request_id=r.rental_request_id,
            sender_id=r.lender_id,
            body=f"返却日時が変更されました。\n{old_end} → {new_end.strftime('%-m/%-d %-H:%M')}",
            is_system=True,
        ))
    await db.commit()
    return _to_response(r)


@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
async def cancel_reservation(
    reservation_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReservationResponse:
    r = await _get_reservation(reservation_id, db)
    uid = uuid.UUID(user_id)
    if r.lender_id != uid and r.renter_id != uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if r.status not in (ReservationStatus.reserved, ReservationStatus.lent):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel")
    r.status = ReservationStatus.cancelled
    await db.commit()
    return _to_response(r)
