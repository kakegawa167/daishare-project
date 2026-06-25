"""
プランの制限チェックサービス。

プラン仕様:
  renter (借りる人):  台車登録不可
  lender normal:      台車1台まで、地点1件/台まで、無料
  lender pro:         台車無制限、地点10件/台まで、¥300/月
  both も lender と同じ制限を適用する

ダウングレード(pro→normal)の制御:
  - plan_expires_at まではProとして扱う（期限切れ後にnormalへ）
  - 制限超過中はフロントで警告バナー表示、新規追加&メッセージ送信をブロック
  - 既存データは削除しない
"""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.cart import Cart, CartLocation, CartStatus
from app.models.user import User, UserType

# プランごとの上限 (None = 無制限)
_LIMITS = {
    "pro":    {"max_carts": None, "max_locations": 10},
    "normal": {"max_carts": 1,    "max_locations": 1},
}


def get_effective_plan(user: User) -> str:
    """有効期限を考慮した実効プランを返す"""
    if (
        user.plan == "pro"
        and user.plan_expires_at is not None
        and user.plan_expires_at > datetime.now(timezone.utc)
    ):
        return "pro"
    return "normal"


def _is_lender(user: User) -> bool:
    return user.user_type in (UserType.lender, UserType.both)


async def check_cart_limit(user: User, db: AsyncSession) -> None:
    """台車新規登録の制限チェック。制限超過なら HTTPException を raise する。"""
    from fastapi import HTTPException, status

    if not _is_lender(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="RENTER_CANNOT_REGISTER_CART")

    plan = get_effective_plan(user)
    max_carts = _LIMITS[plan]["max_carts"]
    if max_carts is None:
        return  # 無制限

    result = await db.execute(
        select(func.count()).select_from(Cart).where(
            Cart.owner_id == user.id,
            Cart.status != CartStatus.deleted,
        )
    )
    count = result.scalar_one()
    if count >= max_carts:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="PLAN_CART_LIMIT_REACHED")


async def check_location_limit(user: User, cart_id: int, new_location_count: int, db: AsyncSession) -> None:
    """地点数の制限チェック（台車登録・更新時）。制限超過なら HTTPException を raise する。"""
    from fastapi import HTTPException, status

    plan = get_effective_plan(user)
    max_locs = _LIMITS[plan]["max_locations"]
    if max_locs is None:
        return

    if new_location_count > max_locs:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="PLAN_LOCATION_LIMIT_REACHED")


async def is_over_limit(user: User, db: AsyncSession) -> bool:
    """
    貸主がノーマルプランの制限を超えているか判定する。
    超過中は新規追加・メッセージ送信をブロックする。
    """
    if not _is_lender(user):
        return False
    if get_effective_plan(user) == "pro":
        return False

    limits = _LIMITS["normal"]

    # 台車数チェック
    result = await db.execute(
        select(func.count()).select_from(Cart).where(
            Cart.owner_id == user.id,
            Cart.status != CartStatus.deleted,
        )
    )
    cart_count = result.scalar_one()
    if cart_count > limits["max_carts"]:
        return True

    # 地点数チェック（いずれかの台車が上限超過）
    result = await db.execute(
        select(Cart).options(selectinload(Cart.locations)).where(
            Cart.owner_id == user.id,
            Cart.status != CartStatus.deleted,
        )
    )
    carts = result.scalars().all()
    for cart in carts:
        if len(cart.locations) > limits["max_locations"]:
            return True

    return False
