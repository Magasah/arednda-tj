import os
from pathlib import Path

# Без .env (CI) подставляем тестовые значения; с .env — используем локальную БД
if not (Path(__file__).parent.parent / ".env").exists():
    os.environ.setdefault("POSTGRES_PASSWORD", "test")
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

# Rate limit в тестах — только в памяти процесса (сбрасывается между тестами)
os.environ["RATE_LIMIT_STORAGE_URI"] = "memory://"
# Тесты не публикуют задачи в Celery — периодические задачи вызываются напрямую
os.environ["CELERY_ENABLED"] = "false"

from collections.abc import AsyncIterator
from typing import Any

import pytest
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import check_database, engine, get_db
from app.core.redis import get_redis
from app.core.storage import StorageService
from app.main import app
from app.models import Category
from scripts.seed_categories import CATEGORIES
from tests.helpers import PHOTO_URL


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Сессия внутри внешней транзакции: всё, что сделал тест, откатывается."""
    if not await check_database():
        pytest.skip("PostgreSQL недоступен — запустите: docker compose up -d db")

    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )

        async def override_get_db() -> AsyncIterator[AsyncSession]:
            yield session

        app.dependency_overrides[get_db] = override_get_db
        try:
            yield session
        finally:
            app.dependency_overrides.pop(get_db, None)
            await session.close()
            await transaction.rollback()


@pytest.fixture
async def fake_redis() -> AsyncIterator[FakeRedis]:
    redis = FakeRedis(decode_responses=True)
    app.dependency_overrides[get_redis] = lambda: redis
    yield redis
    app.dependency_overrides.pop(get_redis, None)
    await redis.aclose()


@pytest.fixture
def mock_storage(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Хранилище фото без MinIO: upload_file возвращает фиксированный URL."""
    uploaded: list[str] = []

    async def fake_upload(self: StorageService, file: Any, folder: str) -> str:
        uploaded.append(folder)
        return PHOTO_URL

    async def fake_delete(self: StorageService, url: str) -> None:
        return None

    async def fake_upload_private(self: StorageService, file: Any, folder: str) -> str:
        uploaded.append(f"private/{folder}")
        return f"private/{folder}/doc.jpg"

    monkeypatch.setattr(StorageService, "upload_file", fake_upload)
    monkeypatch.setattr(StorageService, "upload_private", fake_upload_private)
    monkeypatch.setattr(StorageService, "delete_file", fake_delete)
    return uploaded


@pytest.fixture
async def env(db_session: AsyncSession, fake_redis: FakeRedis, mock_storage: list[str]) -> None:
    """Категории из seed + fakeredis + мок хранилища (всё в транзакции теста)."""
    statement = insert(Category).values(CATEGORIES)
    await db_session.execute(statement.on_conflict_do_nothing(index_elements=[Category.slug]))
    await db_session.flush()
