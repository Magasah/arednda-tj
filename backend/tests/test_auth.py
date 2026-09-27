"""Auth: unit-тесты без реальной БД и Redis (fakeredis + пользователи в памяти)."""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fakeredis.aioredis import FakeRedis
from httpx import AsyncClient
from pydantic import ValidationError

from app.core.database import get_db
from app.core.limiter import limiter
from app.core.redis import get_redis
from app.core.security import (
    InvalidTokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_otp,
    verify_otp,
)
from app.main import app
from app.models import User
from app.services.auth import users
from app.services.auth.otp import OTPService
from app.services.auth.schemas import SendOTPRequest, VerifyOTPRequest

AUTH = "/api/v1/auth"
PHONE = "+992900000001"
CODE = "123456"


class InMemoryUsers:
    def __init__(self, redis: FakeRedis) -> None:
        self.by_id: dict[uuid.UUID, User] = {}
        self.redis = redis

    async def get_by_id(self, _session: object, user_id: uuid.UUID) -> User | None:
        return self.by_id.get(user_id)

    async def get_by_phone(self, _session: object, phone: str) -> User | None:
        return next((u for u in self.by_id.values() if u.phone == phone), None)

    async def get_or_create_verified(self, session: object, phone: str) -> tuple[User, bool]:
        user = await self.get_by_phone(session, phone)
        if user is not None:
            user.verified = True
            return user, False
        user = User(
            id=uuid.uuid7(),
            phone=phone,
            name=None,
            avatar_url=None,
            trust_score=Decimal("4.00"),
            verified=True,
            passport_verified=False,
            is_active=True,
            created_at=datetime.now(UTC),
        )
        self.by_id[user.id] = user
        return user, True


@pytest.fixture
async def auth_env(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[InMemoryUsers]:
    redis = FakeRedis(decode_responses=True)
    store = InMemoryUsers(redis)

    async def no_db() -> AsyncIterator[None]:
        yield None

    app.dependency_overrides[get_redis] = lambda: redis
    app.dependency_overrides[get_db] = no_db
    monkeypatch.setattr(users, "get_by_id", store.get_by_id)
    monkeypatch.setattr(users, "get_by_phone", store.get_by_phone)
    monkeypatch.setattr(users, "get_or_create_verified", store.get_or_create_verified)
    monkeypatch.setattr(OTPService, "generate", staticmethod(lambda: CODE))
    limiter.reset()

    yield store

    app.dependency_overrides.pop(get_redis, None)
    app.dependency_overrides.pop(get_db, None)
    limiter.reset()
    await redis.aclose()


async def _login(client: AsyncClient, phone: str = PHONE) -> dict[str, object]:
    assert (await client.post(f"{AUTH}/send-otp", json={"phone": phone})).status_code == 200
    response = await client.post(f"{AUTH}/verify-otp", json={"phone": phone, "code": CODE})
    assert response.status_code == 200, response.text
    return response.json()


# --- Эндпоинты -------------------------------------------------------------------


async def test_send_otp_success(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    response = await client.post(f"{AUTH}/send-otp", json={"phone": PHONE})
    assert response.status_code == 200
    assert response.json() == {"message": "Код отправлен", "expires_in": 300}


async def test_send_otp_invalid_phone(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    response = await client.post(f"{AUTH}/send-otp", json={"phone": "89001234567"})
    assert response.status_code == 422


async def test_send_otp_rate_limit(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    assert (await client.post(f"{AUTH}/send-otp", json={"phone": PHONE})).status_code == 200
    second = await client.post(f"{AUTH}/send-otp", json={"phone": "+992900000002"})
    assert second.status_code == 429


async def test_verify_otp_wrong_code(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    await client.post(f"{AUTH}/send-otp", json={"phone": PHONE})
    response = await client.post(f"{AUTH}/verify-otp", json={"phone": PHONE, "code": "000000"})
    assert response.status_code == 401


async def test_verify_otp_success(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    body = await _login(client)
    assert body["token_type"] == "bearer"
    assert decode_token(str(body["access_token"]), TokenType.ACCESS)["type"] == "access"
    assert decode_token(str(body["refresh_token"]), TokenType.REFRESH)["type"] == "refresh"


async def test_verify_otp_creates_user(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    first = await _login(client)
    assert first["is_new_user"] is True
    assert len(auth_env.by_id) == 1

    # Второй вход тем же номером: снимаем паузу между SMS и IP-лимит
    limiter.reset()
    await auth_env.redis.delete(f"otp_cooldown:{PHONE}")
    second = await _login(client)
    assert second["is_new_user"] is False
    assert len(auth_env.by_id) == 1


async def test_refresh_token(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    tokens = await _login(client)
    response = await client.post(f"{AUTH}/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200
    new_access = response.json()["access_token"]
    assert new_access != tokens["access_token"]

    me = await client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {new_access}"})
    assert me.status_code == 200

    # access-токен нельзя использовать как refresh
    bad = await client.post(f"{AUTH}/refresh", json={"refresh_token": tokens["access_token"]})
    assert bad.status_code == 401


async def test_me_unauthorized(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    assert (await client.get(f"{AUTH}/me")).status_code == 401
    garbage = await client.get(f"{AUTH}/me", headers={"Authorization": "Bearer abc"})
    assert garbage.status_code == 401


async def test_me_authorized(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    tokens = await _login(client)
    response = await client.get(
        f"{AUTH}/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == PHONE
    # Телефон подтверждён OTP, но is_verified — это проверенный паспорт
    assert body["is_verified"] is False
    assert set(body) == {
        "id",
        "phone",
        "name",
        "avatar_url",
        "trust_score",
        "is_verified",
        "created_at",
    }


async def test_logout(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    tokens = await _login(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = await client.post(
        f"{AUTH}/logout", headers=headers, json={"refresh_token": tokens["refresh_token"]}
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Выход выполнен"}

    assert (await client.get(f"{AUTH}/me", headers=headers)).status_code == 401
    refresh = await client.post(f"{AUTH}/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 401


async def test_verify_otp_bruteforce_blocked(client: AsyncClient, auth_env: InMemoryUsers) -> None:
    await client.post(f"{AUTH}/send-otp", json={"phone": PHONE})
    for _ in range(5):
        wrong = await client.post(f"{AUTH}/verify-otp", json={"phone": PHONE, "code": "000000"})
        assert wrong.status_code == 401
    # 6-я попытка блокируется даже с верным кодом
    blocked = await client.post(f"{AUTH}/verify-otp", json={"phone": PHONE, "code": CODE})
    assert blocked.status_code == 429


# --- Unit: валидация и криптография ----------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+992931234567", "+992931234567"),
        ("93 123 45 67", "+992931234567"),
        ("992931234567", "+992931234567"),
    ],
)
def test_phone_is_normalized(raw: str, expected: str) -> None:
    assert SendOTPRequest(phone=raw).phone == expected


@pytest.mark.parametrize("raw", ["", "12345", "89001234567", "+79161234567", "+9929312345678"])
def test_non_tajik_phone_rejected(raw: str) -> None:
    with pytest.raises(ValidationError):
        SendOTPRequest(phone=raw)


def test_otp_code_must_be_six_digits() -> None:
    with pytest.raises(ValidationError):
        VerifyOTPRequest(phone=PHONE, code="12345")


def test_generated_otp_is_six_digits() -> None:
    codes = {OTPService.generate() for _ in range(200)}
    assert all(len(c) == 6 and c.isdigit() and c[0] != "0" for c in codes)


def test_refresh_token_is_not_accepted_as_access() -> None:
    with pytest.raises(InvalidTokenError):
        decode_token(create_refresh_token(uuid.uuid7()), TokenType.ACCESS)


def test_tampered_token_rejected() -> None:
    token = create_access_token(uuid.uuid7())
    with pytest.raises(InvalidTokenError):
        decode_token(token[:-2] + "xx", TokenType.ACCESS)


def test_otp_hash_and_verify() -> None:
    stored = hash_otp(PHONE, CODE)
    assert stored != CODE
    assert verify_otp(PHONE, CODE, stored)
    assert not verify_otp(PHONE, "000000", stored)
    assert not verify_otp("+992900000009", CODE, stored)
