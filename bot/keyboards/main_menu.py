from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

FIND = "🔍 Найти вещь"
BOOKINGS = "📋 Мои брони"
POST = "➕ Разместить"
PROFILE = "👤 Профиль"
NOTIFICATIONS = "🔔 Уведомления"
SHARE_PHONE = "📱 Поделиться номером"

LOGIN_CALLBACK = "auth:login"


def main_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=FIND), KeyboardButton(text=BOOKINGS)],
            [KeyboardButton(text=POST), KeyboardButton(text=PROFILE)],
            [KeyboardButton(text=NOTIFICATIONS)],
        ],
        resize_keyboard=True,
    )


def login_button() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📱 Войти через телефон", callback_data=LOGIN_CALLBACK)]
        ]
    )


def share_phone() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=SHARE_PHONE, request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def web_link(url: str, text: str = "🌐 Открыть kiroya.tj") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=text, url=url)]])
