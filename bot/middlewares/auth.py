"""Middleware: сессия пользователя в каждом апдейте и проверка входа для защищённых роутеров."""

from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject, User

from api.client import KiroyaAPI, UserSession
from keyboards.main_menu import login_button
from services.session import TokenStore

LOGIN_REQUIRED = "🔐 Чтобы продолжить, войдите в KIROYA по номеру телефона."

Handler = Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]]


class SessionMiddleware(BaseMiddleware):
    """Кладёт в data['user_session'] сессию пользователя Telegram (токены — в Redis)."""

    def __init__(self, api: KiroyaAPI, store: TokenStore) -> None:
        self.api = api
        self.store = store

    async def __call__(self, handler: Handler, event: TelegramObject, data: dict[str, Any]) -> Any:
        user: User | None = data.get("event_from_user")
        if user is not None:
            data["user_session"] = UserSession(self.api, self.store, user.id)
        return await handler(event, data)


class AuthRequiredMiddleware(BaseMiddleware):
    """Для защищённых роутеров: без токена — сообщение и кнопка «Войти»."""

    async def __call__(self, handler: Handler, event: TelegramObject, data: dict[str, Any]) -> Any:
        session: UserSession | None = data.get("user_session")
        if session is not None and await session.is_authorized():
            return await handler(event, data)

        if isinstance(event, CallbackQuery):
            await event.answer()
            if isinstance(event.message, Message):
                await event.message.answer(LOGIN_REQUIRED, reply_markup=login_button())
        elif isinstance(event, Message):
            await event.answer(LOGIN_REQUIRED, reply_markup=login_button())
        return None
