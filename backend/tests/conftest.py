import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.database import Base, get_db
from app.models import *  # noqa: F401,F403

TEST_SCHEMA = "test_daishare"
_BASE_URL = "postgresql+asyncpg://postgres:postgres@host.docker.internal:54322/postgres"
# server_settings でコネクション確立時に search_path を固定（asyncpg は commit 後にリセットするため）
TEST_DB_URL = _BASE_URL


def _make_engine():
    return create_async_engine(
        TEST_DB_URL,
        echo=False,
        poolclass=NullPool,
        connect_args={"server_settings": {"search_path": TEST_SCHEMA}},
    )


@asynccontextmanager
async def _noop_lifespan(app):
    yield


def _build_test_app() -> FastAPI:
    from app.routers import (auth, carts, messages, notifications,
                             rental_requests, reservations, reviews,
                             stations, users)
    app = FastAPI(lifespan=_noop_lifespan)
    for router in (auth.router, users.router, stations.router, carts.router,
                   rental_requests.router, messages.router, reservations.router,
                   reviews.router, notifications.router):
        app.include_router(router)
    return app


_test_app = _build_test_app()


@pytest_asyncio.fixture()
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    # スキーマを初期化（search_path=public で作業）
    init_engine = create_async_engine(_BASE_URL, echo=False, poolclass=NullPool)
    async with init_engine.begin() as conn:
        await conn.execute(text(f'DROP SCHEMA IF EXISTS "{TEST_SCHEMA}" CASCADE'))
        await conn.execute(text(f'CREATE SCHEMA "{TEST_SCHEMA}"'))
    await init_engine.dispose()

    # テスト用スキーマにテーブル作成
    engine = _make_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest_asyncio.fixture()
async def auth_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    from app.core.auth import get_current_user_id
    from app.models.user import User

    test_user_id = str(uuid.uuid4())
    user = User(id=uuid.UUID(test_user_id), email="test@example.com", display_name="テストユーザー")
    db_session.add(user)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_auth():
        return test_user_id

    _test_app.dependency_overrides[get_db] = override_get_db
    _test_app.dependency_overrides[get_current_user_id] = override_auth

    transport = ASGITransport(app=_test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.user_id = test_user_id  # type: ignore[attr-defined]
        yield ac
    _test_app.dependency_overrides.clear()
