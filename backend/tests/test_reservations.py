"""予約一覧・貸出・返却のテスト"""
import uuid
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest


async def _setup_reservation(db_session, auth_client):
    """台車 → リクエスト → 承認 → 予約を作成して reservation_id を返す"""
    from app.models.user import User
    from app.models.cart import Cart
    from app.models.rental_request import RentalRequest
    from app.models.reservation import Reservation

    owner_id = uuid.uuid4()
    owner = User(id=owner_id, email="owner_res@example.com", display_name="オーナー")
    db_session.add(owner)
    await db_session.flush()

    cart = Cart(owner_id=owner_id, title="予約用台車", daily_rate=500, quantity=2, image_urls=[])
    db_session.add(cart)
    await db_session.flush()

    start = date.today() + timedelta(days=3)
    rq = RentalRequest(
        cart_id=cart.id,
        renter_id=uuid.UUID(auth_client.user_id),
        start_date=start,
        end_date=start + timedelta(days=2),
        quantity=1,
        status="accepted",
    )
    db_session.add(rq)
    await db_session.flush()

    from datetime import datetime, timezone
    res = Reservation(
        rental_request_id=rq.id,
        lender_id=owner_id,
        renter_id=uuid.UUID(auth_client.user_id),
        start_date=datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc),
        end_date=datetime.combine(start + timedelta(days=2), datetime.min.time()).replace(tzinfo=timezone.utc),
        quantity=1,
        daily_rate=500,
    )
    db_session.add(res)
    await db_session.commit()
    return res.id, owner_id


@pytest.mark.asyncio
async def test_list_reservations(auth_client, db_session):
    await _setup_reservation(db_session, auth_client)
    res = await auth_client.get("/reservations")
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_lend_and_return(auth_client, db_session):
    from app.core.auth import get_current_user_id
    from app.core.database import get_db
    from tests.conftest import _test_app
    from httpx import ASGITransport, AsyncClient

    reservation_id, owner_id = await _setup_reservation(db_session, auth_client)

    async def override_db():
        yield db_session

    async def owner_auth():
        return str(owner_id)

    _test_app.dependency_overrides[get_db] = override_db
    _test_app.dependency_overrides[get_current_user_id] = owner_auth

    transport = ASGITransport(app=_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as owner_client:
        with patch("app.services.notification_service._send_expo_push", new_callable=AsyncMock):
            lend_res = await owner_client.post(f"/reservations/{reservation_id}/lend")
        assert lend_res.status_code == 200
        assert lend_res.json()["status"] == "lent"

        with patch("app.services.notification_service._send_expo_push", new_callable=AsyncMock):
            return_res = await owner_client.post(f"/reservations/{reservation_id}/return")
        assert return_res.status_code == 200
        assert return_res.json()["status"] == "returned"

    _test_app.dependency_overrides.clear()
