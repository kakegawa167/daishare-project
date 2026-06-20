import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.message import ReservationResponse
from app.services import notification_service

router = APIRouter(prefix="/reservations", tags=["reservations"])


def _to_response(r: Reservation) -> ReservationResponse:
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
    )


async def _get_reservation(reservation_id: int, db: AsyncSession) -> Reservation:
    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.lender),
            selectinload(Reservation.renter),
        )
        .where(Reservation.id == reservation_id)
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
        .options(selectinload(Reservation.lender), selectinload(Reservation.renter))
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
    await notification_service.notify_lend_started(db, r.renter_id, r.id)
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
    await notification_service.notify_returned(db, r.lender_id, r.id)
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
