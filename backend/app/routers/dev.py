"""
開発・デバッグ用エンドポイント

environment が "production" の場合はすべて 403 を返す。
本番デプロイ後は Railway の環境変数 ENVIRONMENT=production を設定して無効化する。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/dev", tags=["dev"])


def _guard():
    if settings.environment == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is disabled in production",
        )


class SetPlanBody(BaseModel):
    plan: str  # "normal" | "pro"


@router.patch("/users/{email}/plan", summary="[Dev only] ユーザーのプランを直接変更する")
async def set_user_plan(
    email: str,
    body: SetPlanBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    _guard()

    if body.plan not in ("normal", "pro"):
        raise HTTPException(status_code=400, detail="plan must be 'normal' or 'pro'")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found: {email}")

    user.plan = body.plan
    user.plan_expires_at = None  # 期限なし（無期限 pro として扱う）
    await db.commit()

    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at,
    }


@router.get("/users", summary="[Dev only] 全ユーザー一覧（プラン確認用）")
async def list_users(db: AsyncSession = Depends(get_db)) -> list[dict]:
    _guard()

    result = await db.execute(select(User).order_by(User.email))
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "display_name": u.display_name,
            "user_type": u.user_type,
            "plan": u.plan,
            "plan_expires_at": str(u.plan_expires_at) if u.plan_expires_at else None,
        }
        for u in users
    ]
