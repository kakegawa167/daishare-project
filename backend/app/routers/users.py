import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.cart import Cart, CartStatus
from app.models.rental_request import RentalRequest, RequestStatus
from app.models.reservation import Reservation, ReservationStatus
from app.models.user import User, UserType
from app.schemas.user import PushTokenRequest, UserResponse, UserUpdateRequest
from app.services.plan_service import is_over_limit
from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["users"])


class PublicUserResponse(BaseModel):
    id: uuid.UUID
    display_name: str
    avatar_url: str | None
    bio: str | None
    user_type: str

    model_config = {"from_attributes": True}


async def _get_user_or_404(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/{user_id}/profile", response_model=PublicUserResponse)
async def get_user_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> User:
    return await _get_user_or_404(user_id, db)


async def _user_response(user: User, db: AsyncSession) -> UserResponse:
    over = await is_over_limit(user, db)
    data = UserResponse.model_validate(user)
    data.is_over_limit = over
    return data


@router.get("/me", response_model=UserResponse)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await _get_user_or_404(user_id, db)
    return await _user_response(user, db)


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await _get_user_or_404(user_id, db)
    uid = uuid.UUID(user_id)

    # 貸す人 → 借りる人 への変更チェック
    new_type = body.user_type
    is_downgrading = (
        new_type == "renter"
        and user.user_type in (UserType.lender, UserType.both)
    )
    if is_downgrading:
        # アクティブなリクエスト（自分が貸主側）が存在する場合はブロック
        active_request_count = (await db.execute(
            select(RentalRequest)
            .join(Cart, RentalRequest.cart_id == Cart.id)
            .where(
                Cart.owner_id == uid,
                RentalRequest.status.in_([
                    RequestStatus.inquiry,
                    RequestStatus.pending,
                    RequestStatus.accepted,
                ]),
            )
        )).scalars().all()

        # アクティブな予約（reserved / lent）が存在する場合もブロック
        active_reservation_count = (await db.execute(
            select(Reservation).where(
                Reservation.lender_id == uid,
                Reservation.status.in_([
                    ReservationStatus.reserved,
                    ReservationStatus.lent,
                ]),
            )
        )).scalars().all()

        if active_request_count or active_reservation_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="有効なリクエストまたは予約があるため、借りる人に変更できません。すべての取引を完了またはキャンセルしてから変更してください。",
            )

        # 自分の台車をすべて非公開（inactive）に変更
        await db.execute(
            update(Cart)
            .where(Cart.owner_id == uid, Cart.status == CartStatus.active)
            .values(status=CartStatus.inactive)
        )

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return await _user_response(user, db)


@router.put("/me/push-token", response_model=UserResponse)
async def update_push_token(
    body: PushTokenRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await _get_user_or_404(user_id, db)
    user.expo_push_token = body.expo_push_token
    await db.commit()
    await db.refresh(user)
    return await _user_response(user, db)
