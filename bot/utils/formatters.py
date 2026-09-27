"""Тексты сообщений (HTML). Все данные из API экранируются."""

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from html import escape
from typing import Any

STATUS = {
    "pending": ("⏳", "Ожидает оплаты"),
    "payment_frozen": ("🔒", "Оплачено, ждёт передачи"),
    "active": ("✅", "Активна"),
    "return_pending": ("🔄", "Ожидает подтверждения"),
    "completed": ("✔️", "Завершена"),
    "cancelled": ("❌", "Отменена"),
    "disputed": ("⚠️", "Спор"),
    "resolved": ("⚖️", "Спор решён"),
}

WELCOME = (
    "👋 <b>Добро пожаловать в KIROYA!</b>\n\n"
    "Первая платформа аренды вещей в Таджикистане.\n"
    "🔒 Деньги защищены эскроу\n"
    "📸 Фото-акт передачи\n"
    "⭐ Рейтинг мастеров\n\n"
    "Чтобы начать — войдите через номер телефона."
)

HELP = (
    "<b>Команды KIROYA</b>\n\n"
    "/start — главное меню\n"
    "/listings — найти вещь по категории\n"
    "/bookings — мои брони\n"
    "/profile — мой профиль\n"
    "/cancel — отменить текущее действие\n"
    "/help — эта справка\n\n"
    "Вход — по номеру телефона и SMS-коду. Оплата замораживается в эскроу "
    "и переходит владельцу только после подтверждения возврата."
)


def normalize_phone(raw: str) -> str | None:
    """+992 90 123 45 67 / 992901234567 / 901234567 → +992901234567. Иначе None."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 9:
        digits = "992" + digits
    phone = f"+{digits}"
    return phone if phone.startswith("+992") and len(phone) == 13 else None


def money(value: Any) -> str:
    try:
        amount = Decimal(str(value))
    except InvalidOperation, TypeError:
        return escape(str(value))
    text = f"{amount:,.2f}".replace(",", " ").removesuffix(".00")
    return text


def ddmmyyyy(value: str) -> str:
    return date.fromisoformat(value).strftime("%d.%m.%Y")


def listing_card(item: dict[str, Any]) -> str:
    rating = (
        f"⭐ {item['rating_avg']:.1f} ({item['rating_count']} отзывов)"
        if item.get("rating_avg") is not None
        else "⭐ Пока без отзывов"
    )
    return (
        f"📦 <b>{escape(item['title'])}</b>\n"
        f"💰 {money(item['price_per_day'])} сом/день\n"
        f"🔒 Депозит: {money(item['deposit_amount'])} сом\n"
        f"{rating}\n"
        f"📍 {escape(item['city'])}"
    )


def listing_detail(item: dict[str, Any]) -> str:
    owner = item["owner"]
    verified = " ✅" if owner.get("is_verified") else ""
    lines = [listing_card(item)]
    if item.get("description"):
        lines.append(f"\n{escape(item['description'])}")
    lines.append(
        f"\n👤 Владелец: {escape(owner.get('name') or 'Без имени')}{verified}\n"
        f"⭐ Доверие: {owner['trust_score']}/5 · сделок: {owner['total_deals']}\n"
        f"{'🟢 Свободна сегодня' if item.get('is_available') else '🔴 Сейчас занята'}"
    )
    return "\n".join(lines)


def booking_line(booking: dict[str, Any]) -> str:
    emoji, text = STATUS.get(booking["status"], ("•", booking["status"]))
    return (
        f"{emoji} {escape(booking['listing']['title'])} · "
        f"{ddmmyyyy(booking['start_date'])}–{ddmmyyyy(booking['end_date'])} · {text}"
    )


def booking_detail(booking: dict[str, Any]) -> str:
    emoji, text = STATUS.get(booking["status"], ("•", booking["status"]))
    return (
        f"📦 <b>{escape(booking['listing']['title'])}</b>\n"
        f"📅 {ddmmyyyy(booking['start_date'])} — {ddmmyyyy(booking['end_date'])} "
        f"({booking['days']} дн.)\n"
        f"💰 Итого: {money(booking['total_price'])} сом\n"
        f"🔒 Депозит: {money(booking['deposit_amount'])} сом\n"
        f"📊 Статус: {emoji} {text}"
    )


def profile_text(me: dict[str, Any]) -> str:
    user, stats = me["user"], me["stats"]
    return_rate = stats.get("return_rate_percent")
    return (
        f"👤 <b>{escape(user.get('name') or 'Без имени')}</b>\n"
        f"📱 {escape(me['phone'])}\n"
        f"⭐ Рейтинг: {me['trust_score']}/5\n"
        f"✅ Паспорт: {'подтверждён' if user.get('is_verified') else 'не подтверждён'}\n\n"
        f"📊 <b>Статистика:</b>\n"
        f"Сделок: {stats['total_deals']}\n"
        f"Споров: {stats['disputes']}\n"
        f"Возвратов: {f'{return_rate}%' if return_rate is not None else '—'}"
    )


def parse_date(raw: str, today: date) -> date | None:
    """«05.10», «05.10.2026», «2026-10-05» → date."""
    raw = raw.strip()
    for pattern in (r"^(\d{1,2})\.(\d{1,2})$", r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$"):
        match = re.match(pattern, raw)
        if match:
            day, month = int(match[1]), int(match[2])
            year = int(match[3]) if match.lastindex == 3 else today.year
            try:
                parsed = date(year, month, day)
            except ValueError:
                return None
            if match.lastindex == 2 and parsed < today:
                parsed = parsed.replace(year=today.year + 1)
            return parsed
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None
