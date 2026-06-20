import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_notifications_empty(auth_client):
    res = await auth_client.get("/notifications")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_read_all_notifications(auth_client, db_session):
    import uuid
    from app.models.notification import Notification, NotificationType

    uid = uuid.UUID(auth_client.user_id)
    n = Notification(user_id=uid, type=NotificationType.message_received, title="テスト", body="本文")
    db_session.add(n)
    await db_session.commit()

    res = await auth_client.post("/notifications/read-all")
    assert res.status_code in (200, 204)

    res = await auth_client.get("/notifications")
    for notif in res.json():
        assert notif["is_read"] is True
