from aiogram.filters.callback_data import CallbackData
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

# Иконки категорий из seed (slug → подпись)
CATEGORIES = [
    ("tech", "💻 Техника"),
    ("tools", "🔧 Инструменты"),
    ("transport", "🛴 Транспорт"),
    ("photo", "📷 Фото и видео"),
    ("events", "🎪 Мероприятия"),
]


class CategoryCB(CallbackData, prefix="cat"):
    slug: str
    page: int = 1


class ListingCB(CallbackData, prefix="lst"):
    action: str  # detail | fav | book | owner
    id: str


class NoopCB(CallbackData, prefix="noop"):
    pass


def categories() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for slug, title in CATEGORIES:
        builder.button(text=title, callback_data=CategoryCB(slug=slug))
    builder.adjust(2)
    return builder.as_markup()


def card(listing_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="👁 Подробнее",
                    callback_data=ListingCB(action="detail", id=listing_id).pack(),
                ),
                InlineKeyboardButton(
                    text="❤️ В избранное",
                    callback_data=ListingCB(action="fav", id=listing_id).pack(),
                ),
            ]
        ]
    )


def pagination(slug: str, page: int, pages: int) -> InlineKeyboardMarkup:
    row = []
    if page > 1:
        row.append(
            InlineKeyboardButton(
                text="⬅️ Назад", callback_data=CategoryCB(slug=slug, page=page - 1).pack()
            )
        )
    row.append(InlineKeyboardButton(text=f"Стр. {page}/{pages}", callback_data=NoopCB().pack()))
    if page < pages:
        row.append(
            InlineKeyboardButton(
                text="➡️ Вперёд", callback_data=CategoryCB(slug=slug, page=page + 1).pack()
            )
        )
    return InlineKeyboardMarkup(inline_keyboard=[row])


def detail(listing_id: str, owner_id: str, slug: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📅 Забронировать",
                    callback_data=ListingCB(action="book", id=listing_id).pack(),
                ),
                InlineKeyboardButton(
                    text="👤 Профиль владельца",
                    callback_data=ListingCB(action="owner", id=owner_id).pack(),
                ),
            ],
            [InlineKeyboardButton(text="⬅️ К списку", callback_data=CategoryCB(slug=slug).pack())],
        ]
    )
