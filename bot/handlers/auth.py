"""Вход по номеру телефона: номер → SMS-код → токены в Redis → привязка Telegram."""

import logging
from html import escape

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message, ReplyKeyboardRemove

from api.client import APIError, KiroyaAPI, UserSession
from keyboards.main_menu import LOGIN_CALLBACK, main_menu, share_phone
from services.session import TokenStore
from states.auth import AuthStates
from utils.formatters import normalize_phone

router = Router(name="auth")
logger = logging.getLogger("kiroya.bot.auth")

ASK_PHONE = (
    "Введите номер телефона в формате <b>+992XXXXXXXXX</b>\nили нажмите «📱 Поделиться номером»."
)
BAD_PHONE = "Неверный формат. Попробуй: <b>+992 90 123 45 67</b>"


@router.callback_query(F.data == LOGIN_CALLBACK)
async def start_login(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.answer()
    await state.set_state(AuthStates.waiting_phone)
    if isinstance(callback.message, Message):
        await callback.message.answer(ASK_PHONE, reply_markup=share_phone())


async def _send_code(message: Message, state: FSMContext, api: KiroyaAPI, raw: str) -> None:
    phone = normalize_phone(raw)
    if phone is None:
        await message.answer(BAD_PHONE)
        return
    assert message.from_user is not None
    try:
        await api.send_otp(phone, telegram_id=message.from_user.id)
    except APIError as exc:
        if exc.status == 429:
            await message.answer(f"⏳ {escape(exc.message)}")
            return
        if exc.status == 422:
            await message.answer(BAD_PHONE)
            return
        raise
    await state.update_data(phone=phone)
    await state.set_state(AuthStates.waiting_code)
    await message.answer(
        f"Код отправлен на {phone}. Введите 6-значный код:", reply_markup=ReplyKeyboardRemove()
    )


@router.message(AuthStates.waiting_phone, F.contact)
async def phone_from_contact(message: Message, state: FSMContext, api: KiroyaAPI) -> None:
    contact = message.contact
    assert contact is not None and message.from_user is not None
    # Принимаем только свой контакт: чужую карточку можно переслать, но войти по ней нельзя
    if contact.user_id != message.from_user.id:
        await message.answer("Отправьте свой номер кнопкой «📱 Поделиться номером».")
        return
    await _send_code(message, state, api, contact.phone_number)


@router.message(AuthStates.waiting_phone, F.text)
async def phone_from_text(message: Message, state: FSMContext, api: KiroyaAPI) -> None:
    await _send_code(message, state, api, message.text or "")


@router.message(AuthStates.waiting_code, F.text)
async def verify_code(
    message: Message,
    state: FSMContext,
    api: KiroyaAPI,
    store: TokenStore,
    user_session: UserSession,
) -> None:
    code = (message.text or "").strip()
    if not (code.isdigit() and len(code) == 6):
        await message.answer("Код — это 6 цифр из SMS. Попробуйте ещё раз.")
        return

    phone = (await state.get_data())["phone"]
    try:
        tokens = await api.verify_otp(phone, code)
    except APIError as exc:
        if exc.status == 401:
            await message.answer("Неверный код. Попробуйте ещё раз.")
            return
        if exc.status == 429:
            await state.clear()
            await message.answer("🚫 Слишком много попыток. Запросите новый код позже: /start")
            return
        raise

    assert message.from_user is not None
    await store.save_login(
        message.from_user.id, tokens["access_token"], tokens.get("refresh_token"), phone
    )
    # Вход состоялся — дальше ничто не должно оставить пользователя в «жду код»
    await state.clear()

    notice = ""
    try:
        # Уведомления о бронях будут приходить в этот чат
        me = await user_session.call(
            "POST", "/users/me/telegram", json={"telegram_id": message.from_user.id}
        )
    except APIError as exc:
        logger.warning("telegram_link_failed status=%s detail=%s", exc.status, exc.detail)
        me = await user_session.me()
        notice = "\n\n🔕 Уведомления в Telegram не включились — включите их в «🔔 Уведомления»."
    name = escape(me["user"].get("name") or phone)
    await message.answer(f"✅ Вы вошли как {name}!{notice}", reply_markup=main_menu())
