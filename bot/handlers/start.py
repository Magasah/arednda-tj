"""/start, /help, /cancel и общая обработка «нужно войти заново»."""

from html import escape
from pathlib import Path

import httpx
from aiogram import F, Router
from aiogram.filters import Command, CommandStart, ExceptionTypeFilter
from aiogram.fsm.context import FSMContext
from aiogram.types import ErrorEvent, FSInputFile, Message

from api.client import APIError, AuthRequired, UserSession
from keyboards.main_menu import login_button, main_menu
from middlewares.auth import LOGIN_REQUIRED
from utils.formatters import HELP, WELCOME

router = Router(name="start")

WELCOME_IMAGE = Path(__file__).resolve().parent.parent / "assets" / "welcome.png"


async def send_welcome(message: Message) -> None:
    if WELCOME_IMAGE.exists():
        await message.answer_photo(
            FSInputFile(WELCOME_IMAGE), caption=WELCOME, reply_markup=login_button()
        )
    else:
        await message.answer(WELCOME, reply_markup=login_button())


async def send_home(message: Message, session: UserSession) -> None:
    me = await session.me()
    name = escape(me["user"].get("name") or "друг")
    await message.answer(
        f"Привет, {name}! ⭐ Рейтинг: {me['trust_score']}", reply_markup=main_menu()
    )


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, user_session: UserSession) -> None:
    await state.clear()
    if not await user_session.is_authorized():
        await send_welcome(message)
        return
    try:
        await send_home(message, user_session)
    except AuthRequired:
        await send_welcome(message)


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(HELP)


@router.message(Command("cancel"))
@router.message(F.text.casefold() == "отмена")
async def cmd_cancel(message: Message, state: FSMContext, user_session: UserSession) -> None:
    await state.clear()
    markup = main_menu() if await user_session.is_authorized() else None
    await message.answer("Действие отменено.", reply_markup=markup)


@router.errors(ExceptionTypeFilter(AuthRequired))
async def on_auth_required(event: ErrorEvent) -> bool:
    """Токен истёк и не обновился — просим войти заново."""
    update = event.update
    target = update.message or (update.callback_query.message if update.callback_query else None)
    if isinstance(target, Message):
        await target.answer(LOGIN_REQUIRED, reply_markup=login_button())
    if update.callback_query:
        await update.callback_query.answer()
    return True


@router.errors(ExceptionTypeFilter(APIError))
async def on_api_error(event: ErrorEvent) -> bool:
    error = event.exception
    assert isinstance(error, APIError)
    text = (
        "⚠️ Сервис временно недоступен, попробуйте позже."
        if error.status >= 500
        else f"⚠️ {escape(error.message)}"
    )
    update = event.update
    if update.callback_query:
        await update.callback_query.answer(text[:190], show_alert=True)
    elif update.message:
        await update.message.answer(text)
    return True


@router.errors(ExceptionTypeFilter(httpx.TransportError))
async def on_backend_down(event: ErrorEvent) -> bool:
    text = "⚠️ Сервис временно недоступен, попробуйте через минуту."
    update = event.update
    if update.callback_query:
        await update.callback_query.answer(text, show_alert=True)
    elif update.message:
        await update.message.answer(text)
    return True
