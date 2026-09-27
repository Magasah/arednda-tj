"""Общий async-клиент Redis (кеш, rate-limit, OTP, очереди)."""

from typing import Annotated

from fastapi import Depends
from redis.asyncio import ConnectionPool, Redis

from app.core.config import settings

pool = ConnectionPool.from_url(
    str(settings.redis_url),
    max_connections=settings.redis_max_connections,
    decode_responses=True,
    health_check_interval=30,
)

redis_client = Redis(connection_pool=pool)


async def check_redis() -> bool:
    """Проверка доступности Redis для readiness-пробы."""
    try:
        return bool(await redis_client.ping())
    except Exception:
        return False


def get_redis() -> Redis:
    """FastAPI-зависимость: в тестах подменяется на fakeredis."""
    return redis_client


RedisDep = Annotated[Redis, Depends(get_redis)]
