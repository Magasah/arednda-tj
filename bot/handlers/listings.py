"""Каталог: категории → карточки с пагинацией → подробности → бронирование."""

import math
from datetime import date, timedelta
from html import escape
from typing import Any

import httpx
from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import BufferedInputFile, CallbackQuery, Message

from api.client import KiroyaAPI, UserSession
from config import get_settings
from keyboards import listings as kb
from keyboards.booking import DaysCB, booking_actions, days_choice
from keyboards.main_menu import FIND, POST, login_button, web_link
from middlewares.auth import LOGIN_REQUIRED
from states.auth import BookingStates
from utils.formatters import booking_detail, listing_card, listing_detail, parse_date

router = Router(name="listings")


@router.message(Command("listings"))
@router.message(F.text == FIND)
async def choose_category(message: Message) -> None:
    await message.answer("Выберите категорию:", reply_markup=kb.categories())


@router.callback_query(kb.NoopCB.filter())
async def noop(callback: CallbackQuery) -> None:
    await callback.answer()


@router.callback_query(kb.CategoryCB.filter())
async def show_category(
    callback: CallbackQuery, callback_data: kb.CategoryCB, api: KiroyaAPI
) -> None:
    await callback.answer()
    settings = get_settings()
    page = await api.get_listings(
        category=callback_data.slug, page=callback_data.page, limit=settings.listings_page_size
    )
    message = callback.message
    if not isinstance(message, Message):
        return
    if not page["items"]:
        await message.answer("В этой категории пока нет объявлений.", reply_markup=kb.categories())
        return
    for item in page["items"]:
        await message.answer(listing_card(item), reply_markup=kb.card(item["id"]))
    pages = page["pages"] or math.ceil(page["total"] / settings.listings_page_size)
    await message.answer(
        f"Найдено: {page['total']}",
        reply_markup=kb.pagination(callback_data.slug, callback_data.page, pages),
    )


async def _photo(url: str) -> BufferedInputFile | None:
    """Скачиваем фото сами: Telegram не видит локальные адреса (localhost/MinIO)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url)
            response.raise_for_status()
    except httpx.HTTPError:
        return None
    return BufferedInputFile(response.content, filename="photo.jpg")


@router.callback_query(kb.ListingCB.filter(F.action == "detail"))
async def show_detail(callback: CallbackQuery, callback_data: kb.ListingCB, api: KiroyaAPI) -> None:
    await callback.answer()
    item = await api.get_listing(callback_data.id)
    markup = kb.detail(item["id"], item["owner"]["id"], item["category_slug"])
    text = listing_detail(item)
    message = callback.message
    if not isinstance(message, Message):
        return
    photo = await _photo(item["photos"][0]) if item.get("photos") else None
    if photo is not None and len(text) <= 1024:
        await message.answer_photo(photo, caption=text, reply_markup=markup)
    else:
        await message.answer(text, reply_markup=markup)


@router.callback_query(kb.ListingCB.filter(F.action == "fav"))
async def add_favorite(callback: CallbackQuery) -> None:
    await callback.answer("❤️ Избранное скоро появится в KIROYA", show_alert=True)


@router.callback_query(kb.ListingCB.filter(F.action == "owner"))
async def owner_profile(
    callback: CallbackQuery, callback_data: kb.ListingCB, api: KiroyaAPI
) -> None:
    await callback.answer()
    profile = await api.get_user_profile(callback_data.id)
    user, stats, summary = profile["user"], profile["stats"], profile["reviews_summary"]
    lines = [
        f"👤 <b>{escape(user.get('name') or 'Без имени')}</b>"
        + (" ✅ паспорт подтверждён" if user.get("is_verified") else ""),
        f"⭐ Доверие: {user['trust_score']}/5",
        f"🤝 Сделок: {stats['total_deals']} · споров: {stats['disputes']}",
        f"💬 Отзывов: {summary['total']}"
        + (f" · средняя {summary['avg']}" if summary.get("avg") else ""),
    ]
    for review in profile["recent_reviews"][:3]:
        text = escape((review.get("text") or "")[:120])
        lines.append(f"\n{'⭐' * review['rating']} {text}")
    if isinstance(callback.message, Message):
        await callback.message.answer("\n".join(lines))


# --- Бронирование из карточки ----------------------------------------------------


@router.callback_query(kb.ListingCB.filter(F.action == "book"))
async def book_start(
    callback: CallbackQuery,
    callback_data: kb.ListingCB,
    state: FSMContext,
    user_session: UserSession,
) -> None:
    await callback.answer()
    if not isinstance(callback.message, Message):
        return
    if not await user_session.is_authorized():
        await callback.message.answer(LOGIN_REQUIRED, reply_markup=login_button())
        return
    await state.set_state(BookingStates.waiting_start_date)
    await state.update_data(listing_id=callback_data.id)
    await callback.message.answer(
        "📅 С какой даты нужна вещь? Например: <b>05.10</b> или <b>05.10.2026</b>\n"
        "Бронировать можно начиная с завтра. /cancel — отменить."
    )


@router.message(BookingStates.waiting_start_date, F.text)
async def book_date(message: Message, state: FSMContext) -> None:
    start = parse_date(message.text or "", date.today())
    if start is None or start <= date.today():
        await message.answer("Укажите дату не раньше завтра, например <b>05.10</b>.")
        return
    await state.update_data(start_date=start.isoformat())
    await state.set_state(BookingStates.waiting_days)
    await message.answer(
        "На сколько дней? День возврата не оплачивается.", reply_markup=days_choice()
    )


@router.callback_query(BookingStates.waiting_days, DaysCB.filter())
async def book_days(
    callback: CallbackQuery, callback_data: DaysCB, state: FSMContext, user_session: UserSession
) -> None:
    await callback.answer()
    data = await state.get_data()
    start = date.fromisoformat(data["start_date"])
    await state.clear()
    body: dict[str, Any] = {
        "listing_id": data["listing_id"],
        "start_date": start.isoformat(),
        "end_date": (start + timedelta(days=callback_data.days)).isoformat(),
    }
    created = await user_session.call("POST", "/bookings", json=body)
    booking = created["booking"]
    if isinstance(callback.message, Message):
        await callback.message.answer(
            "🎉 Бронь создана! Оплатите в течение 15 минут, иначе она отменится.\n\n"
            + booking_detail(booking),
            reply_markup=booking_actions(booking, is_owner=False),
        )


@router.message(F.text == POST)
async def post_listing(message: Message) -> None:
    settings = get_settings()
    await message.answer(
        "➕ Разместить объявление с фото удобнее в приложении KIROYA или на сайте — "
        "там можно загрузить до 8 фотографий и отметить место на карте.",
        reply_markup=web_link(settings.web_url),
    )
