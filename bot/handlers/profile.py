"""Профиль: данные, смена имени, выход."""

from contextlib import suppress

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    ReplyKeyboardRemove,
)

from api.client import APIError, KiroyaAPI, UserSession
from handlers.start import send_welcome
from keyboards.main_menu import PROFILE, main_menu
from middlewares.auth import AuthRequiredMiddleware
from services.session import TokenStore
from states.auth import ProfileStates
from utils.formatters import profile_text

router = Router(name="profile")
router.message.middleware(AuthRequiredMiddleware())
router.callback_query.middleware(AuthRequiredMiddleware())

EDIT_NAME, NOTIFY_SETTINGS, LOGOUT = "profile:name", "profile:notify", "profile:logout"


def profile_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✏️ Изменить имя", callback_data=EDIT_NAME),
                InlineKeyboardButton(
                    text="🔔 Настройки уведомлений", callback_data=NOTIFY_SETTINGS
                ),
            ],
            [InlineKeyboardButton(text="🚪 Выйти", callback_data=LOGOUT)],
        ]
    )


@router.message(Command("profile"))
@router.message(F.text == PROFILE)
async def show_profile(message: Message, user_session: UserSession) -> None:
    me = await user_session.me()
    await message.answer(profile_text(me), reply_markup=profile_keyboard())


@router.callback_query(F.data == EDIT_NAME)
async def ask_name(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    await state.set_state(ProfileStates.waiting_name)
    if isinstance(callback.message, Message):
        await callback.message.answer("Как вас зовут? (до 100 символов) /cancel — отменить.")


@router.message(ProfileStates.waiting_name, F.text)
async def save_name(message: Message, state: FSMContext, user_session: UserSession) -> None:
    await state.clear()
    try:
        me = await user_session.call("PATCH", "/users/me", data={"name": message.text})
    except APIError as exc:
        await message.answer(f"⚠️ {exc.message}")
        return
    await message.answer("✅ Имя обновлено.\n\n" + profile_text(me), reply_markup=main_menu())


@router.callback_query(F.data == LOGOUT)
async def logout(
    callback: CallbackQuery,
    state: FSMContext,
    api: KiroyaAPI,
    store: TokenStore,
    user_session: UserSession,
) -> None:
    await callback.answer()
    token = await store.get_access(user_session.telegram_id)
    refresh = await store.get_refresh(user_session.telegram_id)
    if token:
        # Токен мог уже истечь — всё равно удаляем его локально
        with suppress(APIError):
            await api.logout(token, refresh)
    await store.clear(user_session.telegram_id)
    await state.clear()
    if isinstance(callback.message, Message):
        await callback.message.answer(
            "👋 Вы вышли из аккаунта.", reply_markup=ReplyKeyboardRemove()
        )
        await send_welcome(callback.message)
