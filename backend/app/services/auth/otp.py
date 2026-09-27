"""Одноразовые SMS-коды: генерация, хранение в Redis, лимиты, отправка."""

import secrets

import httpx
from fastapi import HTTPException, status
from redis.asyncio import Redis

from app.core.config import settings
from app.core.logging import logger
from app.core.security import hash_otp, verify_otp


def _code_key(phone: str) -> str:
    return f"otp:{phone}"


def _attempts_key(phone: str) -> str:
    return f"otp_attempts:{phone}"


def _cooldown_key(phone: str) -> str:
    return f"otp_cooldown:{phone}"


class OTPService:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    @staticmethod
    def generate() -> str:
        return str(secrets.randbelow(900000) + 100000)

    async def issue(self, phone: str) -> str:
        """Создаёт код и сохраняет его хеш. Не чаще раза в cooldown на номер."""
        # SET NX — атомарно: защита от SMS-бомбинга одного номера с разных IP
        allowed = await self.redis.set(
            _cooldown_key(phone), "1", ex=settings.otp_resend_cooldown_seconds, nx=True
        )
        if not allowed:
            ttl = await self.redis.ttl(_cooldown_key(phone))
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Повторная отправка через {max(ttl, 1)} с",
                headers={"Retry-After": str(max(ttl, 1))},
            )

        code = self.generate()
        await self.redis.set(_code_key(phone), hash_otp(phone, code), ex=settings.otp_ttl_seconds)
        return code

    async def verify(self, phone: str, code: str) -> bool:
        """True — код верный (ключ удаляется). После otp_max_attempts ошибок — 429."""
        attempts_key = _attempts_key(phone)
        attempts = await self.redis.incr(attempts_key)
        if attempts == 1:
            await self.redis.expire(attempts_key, settings.otp_attempts_window_seconds)
        if attempts > settings.otp_max_attempts:
            # Перебор: сжигаем текущий код, нужно запросить новый после окна
            await self.redis.delete(_code_key(phone))
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Слишком много попыток. Запросите новый код позже",
            )

        stored = await self.redis.get(_code_key(phone))
        if stored is None or not verify_otp(phone, code, stored):
            return False

        await self.redis.delete(_code_key(phone), attempts_key)
        return True

    async def send(self, phone: str, code: str) -> None:
        message = f"KIROYA: код входа {code}. Никому не сообщайте его."

        if settings.is_dev:
            # На dev реальные SMS не отправляем
            logger.info(f"OTP для {phone}: {code}")
            return

        api_key = settings.sms_api_key.get_secret_value()
        if not api_key:
            logger.error("sms_not_configured", phone=phone)
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "SMS временно недоступны")

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    settings.sms_api_url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "phone": phone.lstrip("+"),
                        "message": message,
                        "from": settings.sms_sender,
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("sms_send_failed", phone=phone, error=str(exc))
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "Не удалось отправить SMS"
            ) from exc
