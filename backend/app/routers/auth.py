import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserSyncRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sync", response_model=UserResponse)
async def sync_user(
    body: UserSyncRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """ログイン後にSupabase UIDでユーザーを登録 or 取得する"""
    uid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()

    is_new = False
    if not user:
        user = User(id=uid, email=body.email, display_name=body.display_name)
        db.add(user)
        is_new = True

    user.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    resp = UserResponse.model_validate(user)
    resp.is_new = is_new
    return resp
