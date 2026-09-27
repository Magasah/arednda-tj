from typing import Any

from aiogram.filters.callback_data import CallbackData
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from utils.formatters import booking_line


class BookingCB(CallbackData, prefix="bk"):
    action: str
    id: str = ""


class RoleCB(CallbackData, prefix="bkrole"):
    role: str


class DaysCB(CallbackData, prefix="days"):
    days: int


class RatingCB(CallbackData, prefix="rate"):
    booking_id: str
    rating: int


def _btn(text: str, action: str, booking_id: str) -> InlineKeyboardButton:
    return InlineKeyboardButton(
        text=text, callback_data=BookingCB(action=action, id=booking_id).pack()
    )


def bookings_list(bookings: list[dict[str, Any]], role: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for booking in bookings[:20]:
        builder.row(_btn(booking_line(booking)[:64], "open", booking["id"]))
    other = "owner" if role == "renter" else "renter"
    label = "📦 Брони моих вещей" if other == "owner" else "🛍 Что я арендую"
    builder.row(InlineKeyboardButton(text=label, callback_data=RoleCB(role=other).pack()))
    return builder.as_markup()


def booking_actions(booking: dict[str, Any], is_owner: bool) -> InlineKeyboardMarkup | None:
    status, booking_id = booking["status"], booking["id"]
    rows: list[list[InlineKeyboardButton]] = []
    if not is_owner:
        match status:
            case "pending":
                rows.append(
                    [
                        _btn("💳 Оплатить", "pay", booking_id),
                        _btn("❌ Отменить", "cancel", booking_id),
                    ]
                )
            case "payment_frozen":
                rows.append([_btn("📸 Подтвердить получение", "handover", booking_id)])
            case "active":
                rows.append([_btn("📸 Оформить возврат", "return", booking_id)])
    elif status == "return_pending":
        rows.append(
            [
                _btn("✅ Всё в порядке", "ok", booking_id),
                _btn("⚠️ Есть повреждения", "damaged", booking_id),
            ]
        )
    if status == "completed":
        rows.append([_btn("⭐ Оставить отзыв", "review", booking_id)])
    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else None


def payment_methods(booking_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [_btn("Alif", "pay_alif", booking_id), _btn("Humo", "pay_humo", booking_id)],
        ]
    )


def days_choice() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for days in (1, 2, 3, 5, 7, 14):
        builder.button(text=f"{days} дн.", callback_data=DaysCB(days=days))
    builder.adjust(3)
    return builder.as_markup()


def rating_choice(booking_id: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for rating in range(1, 6):
        builder.button(
            text="⭐" * rating, callback_data=RatingCB(booking_id=booking_id, rating=rating)
        )
    builder.adjust(1)
    return builder.as_markup()


def skip_button(action: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[_btn("Пропустить", action, "")]])
