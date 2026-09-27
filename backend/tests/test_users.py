"""Профиль пользователя: /users/me, аватар, верификация паспорта, публичный профиль."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from tests.helpers import FAKE_JPEG, PHOTO_URL, auth, make_user

URL = "/api/v1/users"


@pytest.fixture
async def user(db_session: AsyncSession, env: None) -> User:
    return await make_user(db_session, "+992900000501", "Сино")


async def test_patch_profile_name(client: AsyncClient, user: User) -> None:
    response = await client.patch(
        f"{URL}/me", headers=auth(user), data={"name": "  Фаридун   Раҳимов "}
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["name"] == "Фаридун Раҳимов"
    assert (await client.get(f"{URL}/me", headers=auth(user))).json()["user"][
        "name"
    ] == "Фаридун Раҳимов"


async def test_patch_profile_avatar(
    client: AsyncClient, user: User, mock_storage: list[str]
) -> None:
    response = await client.patch(
        f"{URL}/me",
        headers=auth(user),
        files={"avatar": ("me.jpg", FAKE_JPEG, "image/jpeg")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["avatar_url"] == PHOTO_URL
    assert f"avatars/{user.id}" in mock_storage

    empty = await client.patch(f"{URL}/me", headers=auth(user))
    assert empty.status_code == 422


async def test_verify_passport(client: AsyncClient, user: User, mock_storage: list[str]) -> None:
    before = (await client.get(f"{URL}/me", headers=auth(user))).json()
    assert before["user"]["is_verified"] is False

    response = await client.post(
        f"{URL}/me/verify",
        headers=auth(user),
        files={"passport_photo": ("passport.jpg", FAKE_JPEG, "image/jpeg")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["is_verified"] is True
    assert body["passport_verified_at"] is not None
    # Фото паспорта — только в приватном хранилище и никогда не отдаётся в API
    assert f"private/passports/{user.id}" in mock_storage
    assert "passport_photo_key" not in response.text


async def test_public_profile_has_trust_breakdown(client: AsyncClient, user: User) -> None:
    body = (await client.get(f"{URL}/{user.id}/profile")).json()
    assert "phone" not in body["user"]
    assert body["trust_breakdown"]["final_score"] == 4.0
    assert set(body["trust_breakdown"]) >= {
        "base_rating", "verified_bonus", "deals_bonus", "penalty", "final_score"
    }  # fmt: skip
    assert body["reviews_summary"] == {
        "total": 0, "avg": None, "distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    }  # fmt: skip
    assert body["response_rate"] is None
