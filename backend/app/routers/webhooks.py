"""
RevenueCat Webhook エンドポイント

RevenueCat の設定で Webhook URL を https://api.daishere.app/v1/webhooks/revenuecat に設定し、
Authorization ヘッダーに REVENUECAT_WEBHOOK_SECRET を設定する。

対応イベント:
  INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE → plan = 'pro', plan_expires_at = expiration_at
  EXPIRATION / CANCELLATION                   → plan = 'normal', plan_expires_at = null
  BILLING_ISSUE                               → 何もしない（RevenueCat が自動リトライ）
"""

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

_UPGRADE_EVENTS = {"INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"}
_DOWNGRADE_EVENTS = {"EXPIRATION", "CANCELLATION"}


@router.post("/revenuecat", status_code=status.HTTP_200_OK)
async def revenuecat_webhook(
    request: Request,
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # シークレット検証
    secret = os.getenv("REVENUECAT_WEBHOOK_SECRET", "")
    if secret and authorization != f"Bearer {secret}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")

    payload = await request.json()
    event = payload.get("event", {})
    event_type: str = event.get("type", "")
    app_user_id: str | None = event.get("app_user_id")  # Supabase user UUID を設定する

    if not app_user_id:
        return {"status": "ignored", "reason": "no app_user_id"}

    try:
        import uuid
        uid = uuid.UUID(app_user_id)
    except ValueError:
        return {"status": "ignored", "reason": "invalid app_user_id"}

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        return {"status": "ignored", "reason": "user not found"}

    if event_type in _UPGRADE_EVENTS:
        # expiration_at は Unix タイムスタンプ（ms）で届く
        exp_ms = event.get("expiration_at_ms")
        if exp_ms:
            user.plan_expires_at = datetime.fromtimestamp(exp_ms / 1000, tz=timezone.utc)
        user.plan = "pro"

    elif event_type in _DOWNGRADE_EVENTS:
        user.plan = "normal"
        user.plan_expires_at = None

    else:
        return {"status": "ignored", "reason": f"unhandled event type: {event_type}"}

    await db.commit()
    return {"status": "ok", "event_type": event_type, "user_id": str(uid)}
