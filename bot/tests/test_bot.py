"""Сценарии бота: /start, вход по SMS-коду, каталог, брони, профиль, обновление токена."""

from datetime import date, timedelta
from typing import Any

from keyboards.listings import CategoryCB, ListingCB
from keyboards.main_menu import BOOKINGS, FIND, LOGIN_CALLBACK, PROFILE
from middlewares.auth import LOGIN_REQUIRED
from tests.conftest import TG_USER, Harness, body, photo
from utils.formatters import money, normalize_phone, parse_date

ME = {
    "user": {"id": "u-1", "name": "Сино", "is_verified": False, "trust_score": "4.80"},
    "stats": {"total_deals": 3, "disputes": 0, "return_rate_percent": 100.0},
    "phone": "+992901234567",
    "trust_score": "4.80",
    "telegram_linked": True,
}


def _listing(i: int) -> dict[str, Any]:
    return {
        "id": f"00000000-0000-7000-8000-00000000000{i}",
        "title": f"Камера {i} <Pro>",
        "price_per_day": "150.00",
        "deposit_amount": "2000.00",
        "rating_avg": 4.9 if i == 1 else None,
        "rating_count": 24 if i == 1 else 0,
        "city": "Душанбе",
        "photos": [],
    }


def _booking(status: str) -> dict[str, Any]:
    return {
        "id": "b-1",
        "status": status,
        "listing": {"title": "Canon EOS R6"},
        "owner_id": "owner-9",
        "start_date": "2026-10-01",
        "end_date": "2026-10-04",
        "days": 3,
        "total_price": "450.00",
        "deposit_amount": "2000.00",
    }


# --- /start ----------------------------------------------------------------------


async def test_start_unauthorized_sends_welcome(harness: Harness) -> None:
    await harness.text("/start")
    [sent] = harness.session.sent()
    assert type(sent).__name__ == "SendPhoto"
    assert "Добро пожаловать в KIROYA" in sent.caption
    assert "Деньги защищены эскроу" in sent.caption
    assert harness.keyboard_texts() == ["📱 Войти через телефон"]


async def test_start_authorized_shows_main_menu(harness: Harness) -> None:
    await harness.login()
    harness.backend.on("GET", "/users/me", body=ME)
    await harness.text("/start")
    assert harness.session.texts()[-1] == "Привет, Сино! ⭐ Рейтинг: 4.80"
    assert harness.keyboard_texts() == [
        "🔍 Найти вещь", "📋 Мои брони", "➕ Разместить", "👤 Профиль", "🔔 Уведомления"
    ]  # fmt: skip


# --- Вход ------------------------------------------------------------------------


async def test_login_flow_saves_tokens_and_links_telegram(harness: Harness) -> None:
    backend = harness.backend
    backend.on("POST", "/auth/send-otp", body={"message": "Код отправлен", "expires_in": 300})
    backend.on(
        "POST",
        "/auth/verify-otp",
        body={"access_token": "acc", "refresh_token": "ref", "is_new_user": True},
    )
    backend.on("POST", "/users/me/telegram", body=ME)

    await harness.click(LOGIN_CALLBACK)
    assert "+992XXXXXXXXX" in harness.session.texts()[-1]
    assert harness.keyboard_texts() == ["📱 Поделиться номером"]

    await harness.text("+992 90 123 45 67")
    otp_request = backend.last("POST", "/auth/send-otp")
    assert body(otp_request) == {"phone": "+992901234567"}
    # rate limit на стороне backend — по пользователю Telegram, а не по IP бота
    assert otp_request.headers["X-Telegram-User-Id"] == str(TG_USER.id)
    assert "Код отправлен на +992901234567" in harness.session.texts()[-1]

    await harness.text("123456")
    assert body(backend.last("POST", "/auth/verify-otp")) == {
        "phone": "+992901234567",
        "code": "123456",
    }
    link = backend.last("POST", "/users/me/telegram")
    assert body(link) == {"telegram_id": TG_USER.id}
    assert link.headers["X-Bot-Secret"] == "test-bot-secret"
    assert link.headers["Authorization"] == "Bearer acc"

    assert await harness.redis.get(f"bot:token:{TG_USER.id}") == "acc"
    assert await harness.redis.get(f"bot:refresh:{TG_USER.id}") == "ref"
    assert await harness.redis.get(f"bot:phone:{TG_USER.id}") == "+992901234567"
    assert 0 < await harness.redis.ttl(f"bot:token:{TG_USER.id}") <= 7 * 86400
    assert harness.session.texts()[-1] == "✅ Вы вошли как Сино!"
    assert "🔍 Найти вещь" in harness.keyboard_texts()


async def test_login_rejects_bad_phone_and_wrong_code(harness: Harness) -> None:
    backend = harness.backend
    backend.on("POST", "/auth/send-otp", body={"message": "ok", "expires_in": 300})
    backend.on("POST", "/auth/verify-otp", status=401, body={"detail": "Неверный код"})

    await harness.click(LOGIN_CALLBACK)
    await harness.text("8900123")
    assert "Неверный формат" in harness.session.texts()[-1]
    assert not [c for c in backend.calls if c.url.path.endswith("send-otp")]

    await harness.text("+992901234567")
    await harness.text("000000")
    assert harness.session.texts()[-1] == "Неверный код. Попробуйте ещё раз."
    assert await harness.redis.get(f"bot:token:{TG_USER.id}") is None


async def test_login_rejects_foreign_contact(harness: Harness) -> None:
    from aiogram.types import Contact

    await harness.click(LOGIN_CALLBACK)
    stranger = Contact(phone_number="992900000000", first_name="Чужой", user_id=999)
    await harness.message(contact=stranger)
    assert "свой номер" in harness.session.texts()[-1]
    assert not harness.backend.calls


# --- Каталог ---------------------------------------------------------------------


async def test_listings_category_cards(harness: Harness) -> None:
    harness.backend.on(
        "GET",
        "/listings",
        body={"items": [_listing(1), _listing(2)], "total": 7, "page": 1, "pages": 2},
    )
    await harness.text(FIND)
    assert harness.keyboard_texts() == [
        "💻 Техника", "🔧 Инструменты", "🛴 Транспорт", "📷 Фото и видео", "🎪 Мероприятия"
    ]  # fmt: skip

    await harness.click(CategoryCB(slug="photo").pack())
    params = harness.backend.last("GET", "/listings").url.params
    assert (params["category"], params["limit"], params["page"]) == ("photo", "5", "1")

    texts = harness.session.texts()
    assert "📦 <b>Камера 1 &lt;Pro&gt;</b>" in texts[-3]  # название экранировано
    assert "💰 150 сом/день" in texts[-3]
    assert "🔒 Депозит: 2 000 сом" in texts[-3]
    assert "⭐ 4.9 (24 отзывов)" in texts[-3]
    assert "📍 Душанбе" in texts[-3]
    assert harness.keyboard_texts(-3) == ["👁 Подробнее", "❤️ В избранное"]
    assert harness.keyboard_texts(-1) == ["Стр. 1/2", "➡️ Вперёд"]


async def test_booking_from_listing_requires_login(harness: Harness) -> None:
    await harness.click(ListingCB(action="book", id="x").pack())
    assert harness.session.texts()[-1] == LOGIN_REQUIRED


# --- Брони -----------------------------------------------------------------------


async def test_bookings_require_login(harness: Harness) -> None:
    await harness.text(BOOKINGS)
    assert harness.session.texts()[-1] == LOGIN_REQUIRED
    assert harness.keyboard_texts() == ["📱 Войти через телефон"]


async def test_bookings_list_and_detail_buttons(harness: Harness) -> None:
    await harness.login()
    harness.backend.on("GET", "/bookings", body=[_booking("pending")])
    harness.backend.on("GET", "/bookings/b-1", body=_booking("pending"))
    harness.backend.on("GET", "/users/me", body=ME)

    await harness.text(BOOKINGS)
    buttons = harness.keyboard_texts()
    assert buttons[0].startswith("⏳ Canon EOS R6")
    assert "Ожидает оплаты" in buttons[0]

    await harness.click("bk:open:b-1")
    detail = harness.session.texts()[-1]
    assert "📅 01.10.2026 — 04.10.2026 (3 дн.)" in detail
    assert "💰 Итого: 450 сом" in detail
    assert "📊 Статус: ⏳ Ожидает оплаты" in detail
    assert harness.keyboard_texts() == ["💳 Оплатить", "❌ Отменить"]


async def test_handover_photo_is_uploaded(harness: Harness) -> None:
    await harness.login()
    harness.backend.on("POST", "/bookings/b-1/handover", body={"status": "active"})
    harness.backend.on("GET", "/bookings/b-1", body=_booking("active"))
    harness.backend.on("GET", "/users/me", body=ME)

    await harness.click("bk:handover:b-1")
    await harness.message(photo=list(photo()))

    upload = harness.backend.last("POST", "/bookings/b-1/handover")
    assert b'name="photos"' in upload.content
    assert b"\xff\xd8\xff" in upload.content
    assert "Получение подтверждено" in harness.session.texts()[-1]
    assert harness.keyboard_texts() == ["📸 Оформить возврат"]


# --- Токены ----------------------------------------------------------------------


async def test_expired_access_is_refreshed(harness: Harness) -> None:
    await harness.login()
    responses = iter([(401, {"detail": "expired"}), (200, ME)])
    harness.backend.routes[("GET", "/users/me")] = lambda _r: next(responses)
    harness.backend.on("POST", "/auth/refresh", body={"access_token": "access-2"})

    await harness.text("/start")
    assert body(harness.backend.last("POST", "/auth/refresh")) == {"refresh_token": "refresh-1"}
    assert await harness.redis.get(f"bot:token:{TG_USER.id}") == "access-2"
    assert harness.session.texts()[-1].startswith("Привет, Сино!")


async def test_refresh_failure_asks_to_login_again(harness: Harness) -> None:
    await harness.login()
    harness.backend.on("GET", "/bookings", status=401, body={"detail": "expired"})
    harness.backend.on("POST", "/auth/refresh", status=401, body={"detail": "revoked"})

    await harness.text(BOOKINGS)
    assert harness.session.texts()[-1] == LOGIN_REQUIRED
    assert await harness.redis.get(f"bot:token:{TG_USER.id}") is None
    assert await harness.redis.get(f"bot:refresh:{TG_USER.id}") is None


# --- Профиль ---------------------------------------------------------------------


async def test_profile_and_logout(harness: Harness) -> None:
    await harness.login()
    harness.backend.on("GET", "/users/me", body=ME)
    harness.backend.on("POST", "/auth/logout", body={"message": "Выход выполнен"})

    await harness.text(PROFILE)
    text = harness.session.texts()[-1]
    assert "👤 <b>Сино</b>" in text
    assert "📱 +992901234567" in text
    assert "⭐ Рейтинг: 4.80/5" in text
    assert "✅ Паспорт: не подтверждён" in text
    assert "Возвратов: 100.0%" in text
    assert harness.keyboard_texts() == ["✏️ Изменить имя", "🔔 Настройки уведомлений", "🚪 Выйти"]

    await harness.click("profile:logout")
    logout = harness.backend.last("POST", "/auth/logout")
    assert logout.headers["Authorization"] == "Bearer access-1"
    assert body(logout) == {"refresh_token": "refresh-1"}
    assert await harness.redis.get(f"bot:token:{TG_USER.id}") is None
    assert "Добро пожаловать" in harness.session.texts()[-1]


# --- Форматирование --------------------------------------------------------------


def test_normalize_phone() -> None:
    assert normalize_phone("+992 90 123 45 67") == "+992901234567"
    assert normalize_phone("992901234567") == "+992901234567"
    assert normalize_phone("90-123-45-67") == "+992901234567"
    assert normalize_phone("+79161234567") is None
    assert normalize_phone("8900123") is None


def test_parse_date_and_money() -> None:
    today = date(2026, 9, 27)
    assert parse_date("05.10", today) == date(2026, 10, 5)
    assert parse_date("05.01", today) == date(2027, 1, 5)  # прошедшая дата → следующий год
    assert parse_date("05.10.2026", today) == date(2026, 10, 5)
    assert parse_date("31.02", today) is None
    assert parse_date("завтра", today) is None
    assert money("2000.00") == "2 000"
    assert money("150.50") == "150.50"
    assert (today + timedelta(days=1)).day == 28


async def test_login_completes_even_if_telegram_link_fails(harness: Harness) -> None:
    """Регрессия (найдено на E2E): сбой привязки оставлял FSM в «жду код»."""
    backend = harness.backend
    backend.on("POST", "/auth/send-otp", body={"message": "ok", "expires_in": 300})
    backend.on("POST", "/auth/verify-otp", body={"access_token": "acc", "refresh_token": "ref"})
    backend.on("POST", "/users/me/telegram", status=403, body={"detail": "forbidden"})
    backend.on("GET", "/users/me", body=ME)
    backend.on("GET", "/bookings", body=[])

    await harness.click(LOGIN_CALLBACK)
    await harness.text("+992901234567")
    await harness.text("123456")
    assert harness.session.texts()[-1].startswith("✅ Вы вошли как Сино!")
    assert "Уведомления в Telegram не включились" in harness.session.texts()[-1]

    await harness.text(BOOKINGS)  # раньше это воспринималось как «неверный код»
    assert "Что я арендую" in harness.session.texts()[-1]
