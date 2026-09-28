"""Объявления аренды (таблица listings)."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from geoalchemy2 import Geography
from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Computed,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Money, TimestampMixin, UUIDv7PKMixin, str_enum


class ListingStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    RENTED = "rented"


class Listing(UUIDv7PKMixin, TimestampMixin, Base):
    __tablename__ = "listings"
    __table_args__ = (
        CheckConstraint("price_per_day > 0", name="price_positive"),
        CheckConstraint("deposit_amount >= 0", name="deposit_non_negative"),
        CheckConstraint("lat BETWEEN -90 AND 90", name="lat_range"),
        CheckConstraint("lng BETWEEN -180 AND 180", name="lng_range"),
        CheckConstraint("(lat IS NULL) = (lng IS NULL)", name="coords_pair"),
        # Геопоиск «рядом со мной» (ST_DWithin) идёт по GIST-индексу
        Index("ix_listings_location", "location", postgresql_using="gist"),
        # Основной фильтр ленты: категория + статус
        Index("ix_listings_category_id_status", "category_id", "status"),
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))

    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    price_per_day: Mapped[Decimal] = mapped_column(Money)
    deposit_amount: Mapped[Decimal] = mapped_column(Money, server_default=text("0"))

    # Город текстом + координаты; PostGIS-точка вычисляется БД из lat/lng
    city: Mapped[str] = mapped_column(String(80), index=True)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    location: Mapped[str | None] = mapped_column(
        Geography("POINT", srid=4326, spatial_index=False),
        Computed(
            "CASE WHEN lat IS NOT NULL AND lng IS NOT NULL "
            "THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography END",
            persisted=True,
        ),
    )

    photos: Mapped[list[str]] = mapped_column(
        ARRAY(String(512)), server_default=text("'{}'::varchar[]")
    )
    status: Mapped[ListingStatus] = mapped_column(
        str_enum(ListingStatus, "listing_status", 16),
        default=ListingStatus.ACTIVE,
        server_default=ListingStatus.ACTIVE.value,
    )
    # Удалено владельцем (не просто скрыто): см. миграцию 0006
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<Listing id={self.id} title={self.title!r}>"
