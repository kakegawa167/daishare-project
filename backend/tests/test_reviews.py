"""レビュー投稿・一覧のテスト"""
import uuid
from datetime import date, timedelta

import pytest


async def _setup_returned_reservation(db_session, auth_client):
    """返却済みの予約を作成して reservation_id と lender_id を返す"""
    from app.models.user import User
    from app.models.cart import Cart
    from app.models.rental_request import RentalRequest
    from app.models.reservation import Reservation

    owner_id = uuid.uuid4()
    owner = User(id=owner_id, email="owner_rev@example.com", display_name="レビューオーナー")
    db_session.add(owner)
    await db_session.flush()

    cart = Cart(owner_id=owner_id, title="レビュー用台車", daily_rate=400, quantity=1, image_urls=[])
    db_session.add(cart)
    await db_session.flush()

    start = date.today() - timedelta(days=3)
    rq = RentalRequest(
        cart_id=cart.id,
        renter_id=uuid.UUID(auth_client.user_id),
        start_date=start,
        end_date=start + timedelta(days=1),
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
        end_date=datetime.combine(start + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc),
        quantity=1,
        daily_rate=400,
        status="returned",
    )
    db_session.add(res)
    await db_session.commit()
    return res.id, owner_id


@pytest.mark.asyncio
async def test_post_review(auth_client, db_session):
    reservation_id, owner_id = await _setup_returned_reservation(db_session, auth_client)

    res = await auth_client.post(
        f"/reservations/{reservation_id}/reviews",
        json={"rating": 3, "comment": "とても良かったです"},
    )
    assert res.status_code == 201
    assert res.json()["rating"] == 3


@pytest.mark.asyncio
async def test_list_reviews(auth_client, db_session):
    _, owner_id = await _setup_returned_reservation(db_session, auth_client)

    list_res = await auth_client.get(f"/users/{owner_id}/reviews")
    assert list_res.status_code == 200
    assert isinstance(list_res.json(), list)


@pytest.mark.asyncio
async def test_duplicate_review_rejected(auth_client, db_session):
    reservation_id, _ = await _setup_returned_reservation(db_session, auth_client)

    await auth_client.post(
        f"/reservations/{reservation_id}/reviews",
        json={"rating": 2, "comment": "1回目"},
    )
    res = await auth_client.post(
        f"/reservations/{reservation_id}/reviews",
        json={"rating": 3, "comment": "2回目（重複）"},
    )
    assert res.status_code in (400, 409)
