import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import PushTokenRequest, UserResponse, UserUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])


async def _get_user_or_404(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/me", response_model=UserResponse)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await _get_user_or_404(user_id, db)


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await _get_user_or_404(user_id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/me/push-token", response_model=UserResponse)
async def update_push_token(
    body: PushTokenRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await _get_user_or_404(user_id, db)
    user.expo_push_token = body.expo_push_token
    await db.commit()
    await db.refresh(user)
    return user
