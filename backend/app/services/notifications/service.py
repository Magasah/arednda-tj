"""Уведомления: Telegram Bot API; без привязанного Telegram — пока только лог (SMS позже).

Для личного чата chat_id в Telegram совпадает с id пользователя, поэтому используется
существующее поле users.telegram_id (отдельный telegram_chat_id не нужен).
"""

import html
import uuid

import httpx

from app.core.config import settings
from app.core.database import SessionFactory
from app.core.logging import logger
from app.models import User

TELEGRAM_API = "https://api.telegram.org"

# Шаблоны в HTML (parse_mode=HTML). Значения подставляются только через render() —
# он экранирует их, чтобы название вещи не ломало разметку и не внедряло свою
BOOKING_RECEIVED = """🎉 <b>Новая бронь!</b>

Вещь: <b>{listing_title}</b>
Период: {start_date} — {end_date}
Сумма: <b>{total_price} сом</b>

Деньги заморожены и будут переданы вам
после подтверждения возврата."""

PAYMENT_FROZEN = """🔒 <b>Оплата заморожена</b>

Передайте вещь арендатору и попросите его подтвердить получение."""

RETURN_PENDING = """📦 <b>Арендатор вернул вещь</b>

Вещь: {listing_title}

Проверьте состояние и подтвердите получение
в приложении или боте."""

REVIEW_REMINDER = """⭐ <b>Оставьте отзыв о сделке</b>

Это помогает сообществу KIROYA."""

RETURN_REMINDER = """⏰ <b>Завтра возврат</b>

{end_date} нужно вернуть «{listing_title}» владельцу."""

DISPUTE_OPENED = """⚠️ <b>Открыт спор</b>

По сделке «{listing_title}» владелец сообщил о повреждении.
Депозит заморожен до решения поддержки."""

BOOKING_CANCELLED = """❌ <b>Бронь отменена</b>

«{listing_title}»: оплата не поступила за {minutes} минут."""


def render(template: str, **values: object) -> str:
    return template.format(**{k: html.escape(str(v)) for k, v in values.items()})


class NotificationService:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        # transport подменяется в тестах, чтобы не ходить в настоящий Telegram
        self.transport = transport

    async def _send_telegram(self, chat_id: int, text: str) -> bool:
        token = settings.telegram_bot_token.get_secret_value()
        if not token:
            return False
        try:
            async with httpx.AsyncClient(timeout=5, transport=self.transport) as client:
                response = await client.post(
                    f"{TELEGRAM_API}/bot{token}/sendMessage",
                    json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("telegram_send_failed", chat_id=chat_id, error=str(exc))
            return False
        return True

    async def deliver(self, user_id: uuid.UUID, telegram_id: int | None, message: str) -> None:
        """Отправка по уже известным данным получателя (без запроса в БД)."""
        if telegram_id is not None and await self._send_telegram(telegram_id, message):
            logger.info("notification_sent", user_id=str(user_id), channel="telegram")
            return
        logger.info("notification_logged", user_id=str(user_id), message=message)

    async def send_to_user(self, user_id: uuid.UUID, message: str) -> None:
        """Отправка по user_id — для фоновых задач, где пользователь ещё не загружен."""
        async with SessionFactory() as session:
            user = await session.get(User, user_id)
        if user is None:
            logger.warning("notification_user_not_found", user_id=str(user_id))
            return
        await self.deliver(user.id, user.telegram_id, message)


notifier = NotificationService()
