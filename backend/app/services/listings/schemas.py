import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from app.models.listing import ListingStatus
from app.schemas.common import ORMModel

_PRICE = {"gt": 0, "max_digits": 12, "decimal_places": 2}
_DEPOSIT = {"ge": 0, "max_digits": 12, "decimal_places": 2}


def _check_coords(lat: float | None, lng: float | None) -> None:
    if (lat is None) != (lng is None):
        raise ValueError("lat и lng передаются вместе")


class CategoryRead(ORMModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": 1,
                    "slug": "tech",
                    "name_ru": "Техника",
                    "name_tj": "Техника",
                    "icon": "kiroya-laptop",
                }
            ]
        },
    )

    id: int
    slug: str
    name_ru: str
    name_tj: str
    icon: str = Field(description="Имя SVG-иконки из web/public/svgicons/kiroya")


class UserShort(ORMModel):
    id: uuid.UUID
    name: str | None
    avatar_url: str | None
    trust_score: Decimal = Field(examples=["4.80"])
    is_verified: bool = Field(
        validation_alias=AliasChoices("is_verified", "passport_verified"),
        description="Паспорт подтверждён",
    )
    total_deals: int = Field(default=0, description="Завершённые сделки (владелец + арендатор)")


class ListingCard(BaseModel):
    """Карточка в ленте."""

    id: uuid.UUID
    title: str = Field(examples=["Canon EOS R6"])
    price_per_day: Decimal = Field(examples=["150.00"], description="Цена за сутки, сомони")
    deposit_amount: Decimal = Field(examples=["2000.00"], description="Депозит, сомони")
    photos: list[str] = Field(description="В ленте — первые 2 фото")
    rating_avg: float | None = Field(examples=[4.9], description="Средняя оценка вещи 1..5")
    rating_count: int = Field(examples=[24])
    city: str = Field(examples=["Душанбе"])
    category_slug: str = Field(examples=["photo"])
    is_verified_owner: bool = Field(description="Паспорт владельца подтверждён")
    owner_id: uuid.UUID
    created_at: datetime


class ListingDetail(ListingCard):
    """Полная карточка: все фото, координаты, владелец."""

    photos: list[str] = Field(description="Все фото объявления")
    description: str | None
    lat: float | None = Field(examples=[38.5767])
    lng: float | None = Field(examples=[68.7794])
    status: ListingStatus
    owner: UserShort
    is_available: bool = Field(description="Сегодня нет активной брони")
    updated_at: datetime


class ListingPage(BaseModel):
    items: list[ListingCard]
    total: int
    page: int
    pages: int


class ListingCreate(BaseModel):
    """Поля формы создания объявления (multipart/form-data, вместе с photos)."""

    title: str = Field(min_length=3, max_length=100, examples=["Canon EOS R6"])
    description: str | None = Field(default=None, max_length=2000)
    category_slug: str = Field(examples=["photo"])
    price_per_day: Decimal = Field(examples=["150"], **_PRICE)
    deposit_amount: Decimal = Field(default=Decimal("0"), examples=["2000"], **_DEPOSIT)
    city: str = Field(min_length=2, max_length=80, examples=["Душанбе"])
    lat: float | None = Field(default=None, ge=-90, le=90, examples=[38.5767])
    lng: float | None = Field(default=None, ge=-180, le=180, examples=[68.7794])

    @model_validator(mode="after")
    def _coords(self) -> ListingCreate:
        _check_coords(self.lat, self.lng)
        return self


class ListingUpdate(BaseModel):
    """PATCH: передаются только изменяемые поля. Фото меняются отдельными эндпоинтами."""

    model_config = ConfigDict(
        json_schema_extra={"examples": [{"price_per_day": "120.00", "city": "Душанбе"}]}
    )

    title: str | None = Field(default=None, min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    category_slug: str | None = None
    price_per_day: Decimal | None = Field(default=None, **_PRICE)
    deposit_amount: Decimal | None = Field(default=None, **_DEPOSIT)
    city: str | None = Field(default=None, min_length=2, max_length=80)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    status: Literal["active", "inactive"] | None = None

    @model_validator(mode="after")
    def _coords(self) -> ListingUpdate:
        if "lat" in self.model_fields_set or "lng" in self.model_fields_set:
            _check_coords(self.lat, self.lng)
        return self


class ListingFilters(BaseModel):
    category: str | None = Field(default=None, description="slug категории")
    city: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    radius: float = Field(default=10.0, gt=0, le=100, description="км, если заданы lat+lng")
    date_from: date | None = Field(default=None, description="дата получения вещи")
    date_to: date | None = Field(default=None, description="дата возврата (не входит в аренду)")
    min_price: Decimal | None = Field(default=None, ge=0)
    max_price: Decimal | None = Field(default=None, ge=0)
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=50)

    @model_validator(mode="after")
    def _check(self) -> ListingFilters:
        _check_coords(self.lat, self.lng)
        if (self.date_from is None) != (self.date_to is None):
            raise ValueError("date_from и date_to передаются вместе")
        if self.date_from and self.date_to and self.date_to <= self.date_from:
            raise ValueError("date_to должна быть позже date_from")
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.max_price < self.min_price
        ):
            raise ValueError("max_price меньше min_price")
        return self
