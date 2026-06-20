import pytest


@pytest.mark.asyncio
async def test_create_and_list_cart(auth_client):
    # 台車作成
    res = await auth_client.post("/carts", json={
        "title": "テスト台車",
        "daily_rate": 1000,
        "quantity": 2,
    })
    assert res.status_code == 201
    cart = res.json()
    assert cart["title"] == "テスト台車"
    assert cart["daily_rate"] == 1000

    # 自分の台車一覧
    res = await auth_client.get("/carts/mine")
    assert res.status_code == 200
    ids = [c["id"] for c in res.json()]
    assert cart["id"] in ids


@pytest.mark.asyncio
async def test_update_cart(auth_client):
    res = await auth_client.post("/carts", json={"title": "更新前", "daily_rate": 500, "quantity": 1})
    cart_id = res.json()["id"]

    res = await auth_client.put(f"/carts/{cart_id}", json={"title": "更新後", "daily_rate": 800, "quantity": 1})
    assert res.status_code == 200
    assert res.json()["title"] == "更新後"


@pytest.mark.asyncio
async def test_delete_cart(auth_client):
    res = await auth_client.post("/carts", json={"title": "削除用", "daily_rate": 300, "quantity": 1})
    cart_id = res.json()["id"]

    res = await auth_client.delete(f"/carts/{cart_id}")
    assert res.status_code == 204

    # 削除後は一覧に出てこない（status=deleted）
    res = await auth_client.get("/carts/mine")
    ids = [c["id"] for c in res.json()]
    assert cart_id not in ids


@pytest.mark.asyncio
async def test_cart_not_found(auth_client):
    res = await auth_client.get("/carts/99999")
    assert res.status_code == 404
