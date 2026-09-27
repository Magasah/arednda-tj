"""Поддержка Telegram-бота на стороне backend."""

from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core import limiter as limiter_module
from app.core.config import settings
from app.models import User
from app.services.notifications.service import BOOKING_RECEIVED, render
from tests.helpers import auth, make_user

SECRET = "test-bot-secret"


@pytest.fixture(autouse=True)
def bot_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "bot_api_secret", SecretStr(SECRET))


@pytest.fixture
async def user(db_session: AsyncSession, env: None) -> User:
    return await make_user(db_session, "+992900000601", "Бот-тест")


def _request(headers: dict[str, str]) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": ("10.0.0.1", 1234)})


def test_rate_limit_key_per_telegram_user_only_for_bot() -> None:
    bot = {"X-Bot-Secret": SECRET, "X-Telegram-User-Id": "777"}
    assert limiter_module.rate_limit_key(_request(bot)) == "tg:777"
    forged = {"X-Bot-Secret": "wrong", "X-Telegram-User-Id": "777"}
    assert limiter_module.rate_limit_key(_request(forged)) == "10.0.0.1"
    assert limiter_module.rate_limit_key(_request({})) == "10.0.0.1"


async def test_link_telegram_requires_bot_secret(
    client: AsyncClient, user: User, db_session: AsyncSession
) -> None:
    url = "/api/v1/users/me/telegram"
    body = {"telegram_id": 555001}
    assert (await client.post(url, headers=auth(user), json=body)).status_code == 403

    linked = await client.post(url, headers={**auth(user), "X-Bot-Secret": SECRET}, json=body)
    assert linked.status_code == 200, linked.text
    assert linked.json()["telegram_linked"] is True

    # Тот же Telegram входит в другой аккаунт — привязка переносится
    other = await make_user(db_session, "+992900000602")
    moved = await client.post(url, headers={**auth(other), "X-Bot-Secret": SECRET}, json=body)
    assert moved.status_code == 200
    await db_session.refresh(user)
    assert user.telegram_id is None

    assert (await client.delete(url, headers=auth(other))).status_code == 204
    await db_session.refresh(other)
    assert other.telegram_id is None


def test_notification_html_is_escaped() -> None:
    text = render(
        BOOKING_RECEIVED,
        listing_title="<b>Дрель</b> & набор",
        start_date="01.10.2026",
        end_date="03.10.2026",
        total_price=Decimal("300.00"),
    )
    assert "&lt;b&gt;Дрель&lt;/b&gt; &amp; набор" in text
    assert "<b>Новая бронь!</b>" in text


async def test_cancel_pending_booking(
    client: AsyncClient, user: User, db_session: AsyncSession
) -> None:
    from tests.test_booking import _dates, _listing

    owner = await make_user(db_session, "+992900000603")
    listing = await _listing(db_session, owner)
    body: dict[str, Any] = {"listing_id": str(listing.id), **_dates()}
    booking_id = (await client.post("/api/v1/bookings", headers=auth(user), json=body)).json()[
        "booking"
    ]["id"]

    foreign = await client.post(f"/api/v1/bookings/{booking_id}/cancel", headers=auth(owner))
    assert foreign.status_code == 403
    cancelled = await client.post(f"/api/v1/bookings/{booking_id}/cancel", headers=auth(user))
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    again = await client.post(f"/api/v1/bookings/{booking_id}/cancel", headers=auth(user))
    assert again.status_code == 409


async def test_notification_sent_to_telegram_as_html(monkeypatch: pytest.MonkeyPatch) -> None:
    import json
    import uuid

    import httpx

    from app.services.notifications.service import RETURN_PENDING, NotificationService

    sent: list[httpx.Request] = []

    def telegram(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(200, json={"ok": True, "result": {}})

    monkeypatch.setattr(settings, "telegram_bot_token", SecretStr("42:TOKEN"))
    service = NotificationService(transport=httpx.MockTransport(telegram))
    text = render(RETURN_PENDING, listing_title="Дрель Bosch")
    await service.deliver(uuid.uuid4(), 555001, text)

    [request] = sent
    assert request.url.path == "/bot42:TOKEN/sendMessage"
    payload = json.loads(request.content)
    assert payload["chat_id"] == 555001
    assert payload["parse_mode"] == "HTML"
    assert "<b>Арендатор вернул вещь</b>" in payload["text"]

    # Без привязанного Telegram — только лог, запросов нет
    await service.deliver(uuid.uuid4(), None, text)
    assert len(sent) == 1
