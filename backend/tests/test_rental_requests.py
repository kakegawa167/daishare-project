"""
リクエスト作成 → 承認 → 予約確認 の主要フロー。
通知サービスの外部呼び出しはモックする。
"""
import uuid
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest


def _future_dates():
    start = date.today() + timedelta(days=3)
    end = start + timedelta(days=2)
    return start.isoformat(), end.isoformat()


@pytest.mark.asyncio
async def test_create_request_and_accept(auth_client, db_session):
    # 台車オーナーを別ユーザーで作成
    owner_id = str(uuid.uuid4())
    from app.models.user import User
    owner = User(id=uuid.UUID(owner_id), email="owner@example.com", display_name="オーナー")
    db_session.add(owner)
    await db_session.commit()

    # オーナーとして台車作成
    from app.core.auth import get_current_user_id
    from app.main import app as _app
    from app.core.database import get_db
    from httpx import ASGITransport, AsyncClient

    async def override_db():
        yield db_session

    async def owner_auth():
        return owner_id

    _app.dependency_overrides[get_db] = override_db
    _app.dependency_overrides[get_current_user_id] = owner_auth

    transport = ASGITransport(app=_app)
    async with AsyncClient(transport=transport, base_url="http://test") as owner_client:
        cart_res = await owner_client.post("/carts", json={"title": "テスト台車2", "daily_rate": 500, "quantity": 1})
        assert cart_res.status_code == 201
        cart_id = cart_res.json()["id"]

    # renter（auth_client）からリクエスト
    _app.dependency_overrides[get_current_user_id] = lambda: auth_client.user_id

    start, end = _future_dates()
    with patch("app.services.notification_service._send_expo_push", new_callable=AsyncMock):
        req_res = await auth_client.post("/rental-requests", json={
            "cart_id": cart_id,
            "start_date": start,
            "end_date": end,
            "quantity": 1,
        })
    assert req_res.status_code == 201
    req_id = req_res.json()["id"]

    # オーナーとして承認
    _app.dependency_overrides[get_current_user_id] = owner_auth
    async with AsyncClient(transport=transport, base_url="http://test") as owner_client:
        with patch("app.services.notification_service._send_expo_push", new_callable=AsyncMock):
            accept_res = await owner_client.post(f"/rental-requests/{req_id}/accept")
        assert accept_res.status_code == 200
        assert accept_res.json()["status"] == "accepted"

    _app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_request_invalid_date(auth_client, db_session):
    # 別ユーザーの台車を用意
    owner_id = str(uuid.uuid4())
    from app.models.user import User
    from app.models.cart import Cart
    owner = User(id=uuid.UUID(owner_id), email="owner2@example.com", display_name="オーナー2")
    db_session.add(owner)
    await db_session.flush()
    cart = Cart(owner_id=uuid.UUID(owner_id), title="テスト台車3", daily_rate=300, quantity=1, image_urls=[])
    db_session.add(cart)
    await db_session.commit()

    # 終了日が開始日より前
    res = await auth_client.post("/rental-requests", json={
        "cart_id": cart.id,
        "start_date": "2099-12-31",
        "end_date": "2099-01-01",
        "quantity": 1,
    })
    assert res.status_code == 422
