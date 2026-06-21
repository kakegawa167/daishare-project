"""メッセージ送信・一覧・既読のテスト"""
import uuid
from unittest.mock import AsyncMock, patch

import pytest


async def _setup_request(db_session, auth_client, _test_app):
    """テスト用に台車 + リクエストを作成して request_id を返す"""
    from datetime import date, timedelta
    from app.models.user import User
    from app.models.cart import Cart
    from app.models.rental_request import RentalRequest
    from app.core.auth import get_current_user_id
    from app.core.database import get_db

    owner_id = uuid.uuid4()
    owner = User(id=owner_id, email="owner_msg@example.com", display_name="オーナー")
    db_session.add(owner)
    await db_session.flush()

    cart = Cart(owner_id=owner_id, title="メッセージ用台車", daily_rate=300, quantity=1, image_urls=[])
    db_session.add(cart)
    await db_session.flush()

    start = date.today() + timedelta(days=3)
    rq = RentalRequest(
        cart_id=cart.id,
        renter_id=uuid.UUID(auth_client.user_id),
        start_date=start,
        end_date=start + timedelta(days=1),
        quantity=1,
    )
    db_session.add(rq)
    await db_session.commit()
    return rq.id


@pytest.mark.asyncio
async def test_send_and_list_messages(auth_client, db_session):
    from tests.conftest import _test_app
    req_id = await _setup_request(db_session, auth_client, _test_app)

    with patch("app.services.notification_service._send_expo_push", new_callable=AsyncMock):
        res = await auth_client.post(f"/rental-requests/{req_id}/messages", json={"body": "こんにちは"})
    assert res.status_code == 201
    assert res.json()["body"] == "こんにちは"

    list_res = await auth_client.get(f"/rental-requests/{req_id}/messages")
    assert list_res.status_code == 200
    bodies = [m["body"] for m in list_res.json()]
    assert "こんにちは" in bodies


@pytest.mark.asyncio
async def test_mark_messages_read(auth_client, db_session):
    from tests.conftest import _test_app
    req_id = await _setup_request(db_session, auth_client, _test_app)

    with patch("app.services.notification_service._send_expo_push", new_callable=AsyncMock):
        await auth_client.post(f"/rental-requests/{req_id}/messages", json={"body": "テスト"})

    res = await auth_client.post(f"/rental-requests/{req_id}/messages/read")
    assert res.status_code in (200, 204)
