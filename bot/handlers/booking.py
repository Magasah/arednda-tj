"""Мои брони: список, детали и действия по статусу (оплата, фото-акт, возврат, отзыв)."""

from html import escape

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from api.client import APIError, UserSession
from keyboards import booking as kb
from keyboards.main_menu import BOOKINGS
from middlewares.auth import AuthRequiredMiddleware
from states.auth import BookingStates, ReviewStates
from utils.formatters import booking_detail

router = Router(name="booking")
router.message.middleware(AuthRequiredMiddleware())
router.callback_query.middleware(AuthRequiredMiddleware())

ROLE_TITLE = {"renter": "📋 <b>Что я арендую</b>", "owner": "📦 <b>Брони моих вещей</b>"}
PHOTO_ACTIONS = {
    "handover": ("handover", "📸 Пришлите фото вещи при получении — оно войдёт в фото-акт."),
    "return": ("return", "📸 Пришлите фото вещи при возврате — владелец сверит состояние."),
}


async def _send_list(message: Message, session: UserSession, role: str) -> None:
    bookings = await session.bookings(role)
    if not bookings:
        await message.answer(
            f"{ROLE_TITLE[role]}\n\nПока пусто.", reply_markup=kb.bookings_list([], role)
        )
        return
    await message.answer(
        f"{ROLE_TITLE[role]}\n\nВыберите бронь:", reply_markup=kb.bookings_list(bookings, role)
    )


async def _send_detail(
    message: Message, session: UserSession, booking_id: str, prefix: str = ""
) -> None:
    booking = await session.booking(booking_id)
    me = await session.me()
    is_owner = booking["owner_id"] == me["user"]["id"]
    await message.answer(
        prefix + booking_detail(booking), reply_markup=kb.booking_actions(booking, is_owner)
    )


@router.message(Command("bookings"))
@router.message(F.text == BOOKINGS)
async def my_bookings(message: Message, user_session: UserSession) -> None:
    await _send_list(message, user_session, "renter")


@router.callback_query(kb.RoleCB.filter())
async def switch_role(
    callback: CallbackQuery, callback_data: kb.RoleCB, user_session: UserSession
) -> None:
    await callback.answer()
    if isinstance(callback.message, Message):
        await _send_list(callback.message, user_session, callback_data.role)


@router.callback_query(kb.BookingCB.filter(F.action == "open"))
async def open_booking(
    callback: CallbackQuery, callback_data: kb.BookingCB, user_session: UserSession
) -> None:
    await callback.answer()
    if isinstance(callback.message, Message):
        await _send_detail(callback.message, user_session, callback_data.id)


# --- Оплата и отмена -------------------------------------------------------------


@router.callback_query(kb.BookingCB.filter(F.action == "pay"))
async def choose_payment(callback: CallbackQuery, callback_data: kb.BookingCB) -> None:
    await callback.answer()
    if isinstance(callback.message, Message):
        await callback.message.answer(
            "💳 Выберите способ оплаты. Сумма и депозит будут заморожены до возврата вещи.",
            reply_markup=kb.payment_methods(callback_data.id),
        )


@router.callback_query(kb.BookingCB.filter(F.action.in_({"pay_alif", "pay_humo"})))
async def pay(
    callback: CallbackQuery, callback_data: kb.BookingCB, user_session: UserSession
) -> None:
    method = callback_data.action.removeprefix("pay_")
    await user_session.call(
        "POST", f"/bookings/{callback_data.id}/confirm-payment", json={"payment_method": method}
    )
    await callback.answer("🔒 Оплата заморожена")
    if isinstance(callback.message, Message):
        await _send_detail(callback.message, user_session, callback_data.id, "✅ Оплачено!\n\n")


@router.callback_query(kb.BookingCB.filter(F.action == "cancel"))
async def cancel(
    callback: CallbackQuery, callback_data: kb.BookingCB, user_session: UserSession
) -> None:
    await user_session.call("POST", f"/bookings/{callback_data.id}/cancel")
    await callback.answer("Бронь отменена")
    if isinstance(callback.message, Message):
        await _send_detail(callback.message, user_session, callback_data.id)


# --- Фото-акт: получение и возврат -----------------------------------------------


@router.callback_query(kb.BookingCB.filter(F.action.in_(set(PHOTO_ACTIONS))))
async def ask_photo(
    callback: CallbackQuery, callback_data: kb.BookingCB, state: FSMContext
) -> None:
    await callback.answer()
    endpoint, prompt = PHOTO_ACTIONS[callback_data.action]
    await state.set_state(BookingStates.waiting_photo)
    await state.update_data(booking_id=callback_data.id, endpoint=endpoint)
    if isinstance(callback.message, Message):
        await callback.message.answer(prompt + "\n/cancel — отменить.")


@router.message(BookingStates.waiting_photo, F.photo)
async def receive_photo(
    message: Message, state: FSMContext, bot: Bot, user_session: UserSession
) -> None:
    data = await state.get_data()
    assert message.photo
    file = await bot.download(message.photo[-1].file_id)
    assert file is not None
    try:
        await user_session.call(
            "POST",
            f"/bookings/{data['booking_id']}/{data['endpoint']}",
            files=[("photos", ("photo.jpg", file.read(), "image/jpeg"))],
        )
    except APIError as exc:
        await state.clear()
        await message.answer(f"⚠️ {escape(exc.message)}")
        return
    await state.clear()
    done = (
        "✅ Получение подтверждено, аренда началась.\n\n"
        if data["endpoint"] == "handover"
        else "🔄 Возврат оформлен — ждём подтверждения владельца.\n\n"
    )
    await _send_detail(message, user_session, data["booking_id"], done)


@router.message(BookingStates.waiting_photo)
async def photo_expected(message: Message) -> None:
    await message.answer("Пришлите фотографию вещи (как фото, не файлом) или /cancel.")


# --- Подтверждение возврата владельцем -------------------------------------------


@router.callback_query(kb.BookingCB.filter(F.action == "ok"))
async def confirm_good(
    callback: CallbackQuery, callback_data: kb.BookingCB, user_session: UserSession
) -> None:
    result = await user_session.call(
        "POST", f"/bookings/{callback_data.id}/confirm-return", json={"condition": "good"}
    )
    await callback.answer("Сделка завершена")
    if isinstance(callback.message, Message):
        await callback.message.answer(
            f"✅ Сделка завершена. Вам к выплате: <b>{result['payout_amount']} сом</b>.\n"
            "Депозит возвращён арендатору."
        )
        await _send_detail(callback.message, user_session, callback_data.id)


@router.callback_query(kb.BookingCB.filter(F.action == "damaged"))
async def ask_damage(
    callback: CallbackQuery, callback_data: kb.BookingCB, state: FSMContext
) -> None:
    await callback.answer()
    await state.set_state(BookingStates.waiting_damage)
    await state.update_data(booking_id=callback_data.id)
    if isinstance(callback.message, Message):
        await callback.message.answer(
            "⚠️ Опишите повреждение одним сообщением — откроется спор, депозит останется "
            "замороженным до решения поддержки. /cancel — отменить."
        )


@router.message(BookingStates.waiting_damage, F.text)
async def confirm_damaged(message: Message, state: FSMContext, user_session: UserSession) -> None:
    booking_id = (await state.get_data())["booking_id"]
    await state.clear()
    await user_session.call(
        "POST",
        f"/bookings/{booking_id}/confirm-return",
        json={"condition": "damaged", "damage_description": message.text},
    )
    await message.answer("⚠️ Спор открыт. Поддержка свяжется с обеими сторонами.")


# --- Отзыв -----------------------------------------------------------------------


@router.callback_query(kb.BookingCB.filter(F.action == "review"))
async def ask_rating(callback: CallbackQuery, callback_data: kb.BookingCB) -> None:
    await callback.answer()
    if isinstance(callback.message, Message):
        await callback.message.answer(
            "⭐ Оцените сделку:", reply_markup=kb.rating_choice(callback_data.id)
        )


@router.callback_query(kb.RatingCB.filter())
async def ask_review_text(
    callback: CallbackQuery, callback_data: kb.RatingCB, state: FSMContext
) -> None:
    await callback.answer()
    await state.set_state(ReviewStates.waiting_text)
    await state.update_data(booking_id=callback_data.booking_id, rating=callback_data.rating)
    if isinstance(callback.message, Message):
        await callback.message.answer(
            "Напишите пару слов о сделке (до 500 символов) или пропустите.",
            reply_markup=kb.skip_button("review_skip"),
        )


async def _post_review(
    target: Message, state: FSMContext, session: UserSession, text: str | None
) -> None:
    data = await state.get_data()
    await state.clear()
    try:
        await session.call(
            "POST",
            "/reviews",
            json={"booking_id": data["booking_id"], "rating": data["rating"], "text": text},
        )
    except APIError as exc:
        await target.answer(f"⚠️ {escape(exc.message)}")
        return
    await target.answer("🙏 Спасибо! Отзыв опубликован.")


@router.message(ReviewStates.waiting_text, F.text)
async def review_text(message: Message, state: FSMContext, user_session: UserSession) -> None:
    await _post_review(message, state, user_session, (message.text or "")[:500])


@router.callback_query(ReviewStates.waiting_text, kb.BookingCB.filter(F.action == "review_skip"))
async def review_skip(
    callback: CallbackQuery, state: FSMContext, user_session: UserSession
) -> None:
    await callback.answer()
    if isinstance(callback.message, Message):
        await _post_review(callback.message, state, user_session, None)
