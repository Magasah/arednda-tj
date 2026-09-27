"""Запуск async-кода из синхронных задач Celery.

Каждая задача выполняется в своём event loop (asyncio.run), поэтому соединения
к БД и Redis создаются внутри вызова, без общих пулов (NullPool).
"""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.cache import CacheService
from app.core.config import settings


@asynccontextmanager
async def task_resources() -> AsyncIterator[tuple[AsyncSession, CacheService]]:
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    redis = Redis.from_url(str(settings.redis_url), decode_responses=True)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as session:
            yield session, CacheService(redis)
    finally:
        await redis.aclose()
        await engine.dispose()


def run[T](fn: Callable[[], Awaitable[T]]) -> T:
    async def main() -> T:
        return await fn()

    return asyncio.run(main())
