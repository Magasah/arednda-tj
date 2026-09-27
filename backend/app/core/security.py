"""JWT-токены и хеширование одноразовых кодов (OTP).

Паролей в KIROYA нет — вход по номеру телефона + SMS-код,
поэтому bcrypt/passlib не нужны: OTP живёт минуты и хранится как HMAC.
"""

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis

from app.core.config import settings
from app.core.database import SessionDep
from app.core.redis import RedisDep
from app.models import User
from app.services.auth import users


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class InvalidTokenError(Exception):
    """Токен просрочен, подделан или неверного типа."""


def _secret() -> str:
    return settings.jwt_secret_key.get_secret_value()


def _create_token(subject: uuid.UUID, token_type: TokenType, lifetime: timedelta) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type.value,
        "iat": now,
        "exp": now + lifetime,
        # jti — для отзыва refresh-токенов через denylist в Redis
        "jti": uuid.uuid7().hex,
    }
    return jwt.encode(payload, _secret(), algorithm=settings.jwt_algorithm)


def create_access_token(user_id: uuid.UUID) -> str:
    return _create_token(
        user_id,
        TokenType.ACCESS,
        timedelta(minutes=settings.jwt_access_token_expire_minutes),
    )


def create_refresh_token(user_id: uuid.UUID) -> str:
    return _create_token(
        user_id,
        TokenType.REFRESH,
        timedelta(days=settings.jwt_refresh_token_expire_days),
    )


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            _secret(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "type", "exp", "iat", "jti"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    if payload["type"] != expected_type.value:
        raise InvalidTokenError("Неверный тип токена")
    return payload


def generate_otp(length: int = 6) -> str:
    """Криптостойкий цифровой код для SMS."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


def hash_otp(phone: str, code: str) -> str:
    """HMAC(phone:code) — в Redis хранится только хеш, не сам код."""
    message = f"{phone}:{code}".encode()
    return hmac.new(_secret().encode(), message, hashlib.sha256).hexdigest()


def verify_otp(phone: str, code: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(phone, code), expected_hash)


# --- FastAPI: проверка токенов и текущий пользователь ---------------------------

bearer_scheme = HTTPBearer(auto_error=False, description="access_token из /auth/verify-otp")

_UNAUTHORIZED_HEADERS = {"WWW-Authenticate": "Bearer"}


def _unauthorized(detail: str = "Требуется авторизация") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers=_UNAUTHORIZED_HEADERS)


def _blacklist_key(jti: str) -> str:
    return f"blacklist:{jti}"


def verify_token(token: str, token_type: str | TokenType) -> uuid.UUID:
    """Декодирует токен нужного типа и возвращает user_id. Ошибка → 401."""
    try:
        payload = decode_token(token, TokenType(token_type))
        return uuid.UUID(payload["sub"])
    except (InvalidTokenError, ValueError) as exc:
        raise _unauthorized("Недействительный токен") from exc


async def is_revoked(redis: Redis, payload: dict[str, Any]) -> bool:
    return bool(await redis.exists(_blacklist_key(payload["jti"])))


async def revoke(redis: Redis, payload: dict[str, Any]) -> None:
    """Кладёт jti в blacklist до истечения срока токена."""
    ttl = int(payload["exp"] - datetime.now(UTC).timestamp())
    if ttl > 0:
        await redis.set(_blacklist_key(payload["jti"]), "1", ex=ttl)


async def decode_active_token(redis: Redis, token: str, token_type: TokenType) -> dict[str, Any]:
    """decode + проверка blacklist. Ошибка → 401."""
    try:
        payload = decode_token(token, token_type)
    except InvalidTokenError as exc:
        raise _unauthorized("Недействительный токен") from exc
    if await is_revoked(redis, payload):
        raise _unauthorized("Токен отозван")
    return payload


async def get_current_token(
    redis: RedisDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    return await decode_active_token(redis, credentials.credentials, TokenType.ACCESS)


async def get_current_user(
    session: SessionDep,
    payload: Annotated[dict[str, Any], Depends(get_current_token)],
) -> User:
    user = await users.get_by_id(session, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise _unauthorized("Пользователь не найден или заблокирован")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentTokenPayload = Annotated[dict[str, Any], Depends(get_current_token)]


async def get_admin_user(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только администраторам")
    return user


AdminUser = Annotated[User, Depends(get_admin_user)]
