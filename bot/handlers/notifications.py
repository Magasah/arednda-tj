"""Уведомления: backend присылает их в этот чат через Bot API. Здесь — включение/выключение."""

from aiogram import F, Router
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from api.client import UserSession
from handlers.profile import NOTIFY_SETTINGS
from keyboards.main_menu import NOTIFICATIONS
from middlewares.auth import AuthRequiredMiddleware

router = Router(name="notifications")
router.message.middleware(AuthRequiredMiddleware())
router.callback_query.middleware(AuthRequiredMiddleware())

NOTIFY_ON, NOTIFY_OFF = "notify:on", "notify:off"

ABOUT = (
    "🔔 <b>Уведомления</b>\n\n"
    "Сюда приходят: новые брони ваших вещей, заморозка оплаты, возврат вещи, "
    "напоминания о возврате и об отзыве, споры.\n\n"
    "Статус: {status}"
)


def _keyboard(enabled: bool) -> InlineKeyboardMarkup:
    button = (
        InlineKeyboardButton(text="🔕 Выключить", callback_data=NOTIFY_OFF)
        if enabled
        else InlineKeyboardButton(text="🔔 Включить", callback_data=NOTIFY_ON)
    )
    return InlineKeyboardMarkup(inline_keyboard=[[button]])


async def _show(message: Message, session: UserSession) -> None:
    enabled = bool((await session.me()).get("telegram_linked"))
    status = "✅ включены в этом чате" if enabled else "🔕 выключены"
    await message.answer(ABOUT.format(status=status), reply_markup=_keyboard(enabled))


@router.message(F.text == NOTIFICATIONS)
async def notifications_menu(message: Message, user_session: UserSession) -> None:
    await _show(message, user_session)


@router.callback_query(F.data == NOTIFY_SETTINGS)
async def notifications_settings(callback: CallbackQuery, user_session: UserSession) -> None:
    await callback.answer()
    if isinstance(callback.message, Message):
        await _show(callback.message, user_session)


@router.callback_query(F.data.in_({NOTIFY_ON, NOTIFY_OFF}))
async def toggle(callback: CallbackQuery, user_session: UserSession) -> None:
    if callback.data == NOTIFY_ON:
        await user_session.call(
            "POST", "/users/me/telegram", json={"telegram_id": user_session.telegram_id}
        )
        await callback.answer("Уведомления включены")
    else:
        await user_session.call("DELETE", "/users/me/telegram")
        await callback.answer("Уведомления выключены")
    if isinstance(callback.message, Message):
        await _show(callback.message, user_session)
