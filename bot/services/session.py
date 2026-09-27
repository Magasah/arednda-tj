"""Токены пользователей бота в Redis.

bot:token:{telegram_id}   → access_token  (TTL 7 дней; сам токен живёт 15 мин и обновляется)
bot:refresh:{telegram_id} → refresh_token (TTL 30 дней)
bot:phone:{telegram_id}   → номер телефона
"""

from redis.asyncio import Redis


class TokenStore:
    def __init__(self, redis: Redis, token_ttl_days: int, refresh_ttl_days: int) -> None:
        self.redis = redis
        self.token_ttl = token_ttl_days * 86400
        self.refresh_ttl = refresh_ttl_days * 86400

    @staticmethod
    def _key(kind: str, telegram_id: int) -> str:
        return f"bot:{kind}:{telegram_id}"

    async def save_login(
        self, telegram_id: int, access: str, refresh: str | None, phone: str
    ) -> None:
        async with self.redis.pipeline(transaction=True) as pipe:
            pipe.set(self._key("token", telegram_id), access, ex=self.token_ttl)
            pipe.set(self._key("phone", telegram_id), phone, ex=self.refresh_ttl)
            if refresh:
                pipe.set(self._key("refresh", telegram_id), refresh, ex=self.refresh_ttl)
            await pipe.execute()

    async def save_access(self, telegram_id: int, access: str) -> None:
        await self.redis.set(self._key("token", telegram_id), access, ex=self.token_ttl)

    async def get_access(self, telegram_id: int) -> str | None:
        return await self.redis.get(self._key("token", telegram_id))

    async def get_refresh(self, telegram_id: int) -> str | None:
        return await self.redis.get(self._key("refresh", telegram_id))

    async def get_phone(self, telegram_id: int) -> str | None:
        return await self.redis.get(self._key("phone", telegram_id))

    async def clear(self, telegram_id: int) -> None:
        await self.redis.delete(
            *(self._key(kind, telegram_id) for kind in ("token", "refresh", "phone"))
        )
