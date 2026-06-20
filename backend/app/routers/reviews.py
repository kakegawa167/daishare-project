import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.reservation import Reservation, ReservationStatus
from app.models.review import Review

router = APIRouter(tags=["reviews"])


class ReviewCreate(BaseModel):
    rating: int
    comment: str = ""

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if not 1 <= v <= 3:
            raise ValueError("rating must be between 1 and 3")
        return v


class ReviewResponse(BaseModel):
    id: int
    reservation_id: int
    reviewer_id: uuid.UUID
    reviewee_id: uuid.UUID
    rating: int
    comment: str
    created_at: datetime
    reviewer_name: str | None = None

    model_config = {"from_attributes": True}


@router.post("/reservations/{reservation_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    reservation_id: int,
    body: ReviewCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReviewResponse:
    result = await db.execute(
        select(Reservation)
        .options(selectinload(Reservation.lender), selectinload(Reservation.renter))
        .where(Reservation.id == reservation_id)
    )
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    if res.status != ReservationStatus.returned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only review returned reservations")

    uid = uuid.UUID(user_id)
    if res.lender_id == uid:
        reviewee_id = res.renter_id
    elif res.renter_id == uid:
        reviewee_id = res.lender_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # 重複チェック
    existing = await db.execute(
        select(Review).where(Review.reservation_id == reservation_id, Review.reviewer_id == uid)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already reviewed")

    review = Review(
        reservation_id=reservation_id,
        reviewer_id=uid,
        reviewee_id=reviewee_id,
        rating=body.rating,
        comment=body.comment,
    )
    db.add(review)
    await db.commit()

    result = await db.execute(
        select(Review).options(selectinload(Review.reviewer)).where(Review.id == review.id)
    )
    review = result.scalar_one()
    return ReviewResponse(
        id=review.id,
        reservation_id=review.reservation_id,
        reviewer_id=review.reviewer_id,
        reviewee_id=review.reviewee_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        reviewer_name=review.reviewer.display_name if review.reviewer else None,
    )


@router.get("/users/{user_id}/reviews", response_model=list[ReviewResponse])
async def get_user_reviews(
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[ReviewResponse]:
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.reviewee_id == uuid.UUID(user_id))
        .order_by(Review.created_at.desc())
    )
    reviews = result.scalars().all()
    return [
        ReviewResponse(
            id=r.id,
            reservation_id=r.reservation_id,
            reviewer_id=r.reviewer_id,
            reviewee_id=r.reviewee_id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
            reviewer_name=r.reviewer.display_name if r.reviewer else None,
        )
        for r in reviews
    ]
