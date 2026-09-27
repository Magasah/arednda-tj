"""Бронирования (таблица bookings)."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Money, TimestampMixin, UUIDv7PKMixin, str_enum


class BookingStatus(StrEnum):
    PENDING = "pending"
    PAYMENT_FROZEN = "payment_frozen"
    ACTIVE = "active"
    RETURN_PENDING = "return_pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DISPUTED = "disputed"
    RESOLVED = "resolved"


# Бронь «держит» даты: вещь нельзя забронировать повторно на эти дни.
# completed/resolved/cancelled даты освобождают (например, досрочный возврат)
HOLDING_STATUSES = (
    BookingStatus.PENDING,
    BookingStatus.PAYMENT_FROZEN,
    BookingStatus.ACTIVE,
    BookingStatus.RETURN_PENDING,
    BookingStatus.DISPUTED,
)

# Идёт аренда (деньги заморожены или вещь у арендатора): объявление нельзя менять/удалять
IN_PROGRESS_STATUSES = (
    BookingStatus.PAYMENT_FROZEN,
    BookingStatus.ACTIVE,
    BookingStatus.RETURN_PENDING,
    BookingStatus.DISPUTED,
)

_HOLDING_SQL = ", ".join(f"'{s.value}'" for s in HOLDING_STATUSES)


class Booking(UUIDv7PKMixin, TimestampMixin, Base):
    __tablename__ = "bookings"
    __table_args__ = (
        # Период [start_date, end_date): end_date — день возврата, он не оплачивается
        # и в этот же день вещь можно отдать следующему арендатору
        CheckConstraint("end_date > start_date", name="dates_order"),
        CheckConstraint("total_price >= 0", name="total_price_non_negative"),
        CheckConstraint("deposit_amount >= 0", name="deposit_non_negative"),
        # Одна вещь не может быть забронирована дважды на пересекающиеся даты.
        # Гарантия на уровне БД — защищает от гонки двух одновременных запросов.
        ExcludeConstraint(
            ("listing_id", "="),
            (text("daterange(start_date, end_date, '[)')"), "&&"),
            name="ex_bookings_no_overlap",
            using="gist",
            where=text(f"status IN ({_HOLDING_SQL})"),
        ),
    )

    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="RESTRICT"), index=True
    )
    renter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    total_price: Mapped[Decimal] = mapped_column(Money)
    deposit_amount: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[BookingStatus] = mapped_column(
        str_enum(BookingStatus, "booking_status", 20),
        default=BookingStatus.PENDING,
        server_default=BookingStatus.PENDING.value,
        index=True,
    )
    # Когда сделка завершена: от этого момента считаются дедлайн отзыва и антифрод
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<Booking id={self.id} status={self.status}>"
