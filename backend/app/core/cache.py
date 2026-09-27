"""JSON-кэш в Redis. Сбой Redis не ломает запрос — считается промахом кэша."""

import json
from typing import Annotated, Any

from fastapi import Depends
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.logging import logger
from app.core.redis import RedisDep

CATEGORIES_KEY = "categories:all"
CATEGORIES_TTL = 3600
LISTING_TTL = 300


def listing_key(listing_id: object) -> str:
    return f"listing:{listing_id}"


class CacheService:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    async def get(self, key: str) -> Any | None:
        try:
            raw = await self.redis.get(key)
        except RedisError as exc:
            logger.warning("cache_get_failed", key=key, error=str(exc))
            return None
        return None if raw is None else json.loads(raw)

    async def set(self, key: str, value: Any, ttl: int) -> None:
        try:
            await self.redis.set(key, json.dumps(value, ensure_ascii=False), ex=ttl)
        except RedisError as exc:
            logger.warning("cache_set_failed", key=key, error=str(exc))

    async def delete(self, key: str) -> None:
        try:
            await self.redis.delete(key)
        except RedisError as exc:
            logger.warning("cache_delete_failed", key=key, error=str(exc))

    async def delete_pattern(self, pattern: str) -> None:
        """SCAN + DELETE пачками — без блокирующего KEYS."""
        try:
            batch: list[str] = []
            async for key in self.redis.scan_iter(match=pattern, count=500):
                batch.append(key)
                if len(batch) >= 500:
                    await self.redis.delete(*batch)
                    batch.clear()
            if batch:
                await self.redis.delete(*batch)
        except RedisError as exc:
            logger.warning("cache_delete_pattern_failed", pattern=pattern, error=str(exc))


def get_cache(redis: RedisDep) -> CacheService:
    return CacheService(redis)


CacheDep = Annotated[CacheService, Depends(get_cache)]
