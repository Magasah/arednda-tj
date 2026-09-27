"""Споры по сделкам (таблица disputes)."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Money, UUIDv7PKMixin, str_enum


class DisputeStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Dispute(UUIDv7PKMixin, Base):
    __tablename__ = "disputes"
    __table_args__ = (CheckConstraint("damage_amount >= 0", name="damage_amount_non_negative"),)

    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="RESTRICT"), unique=True
    )
    opened_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[DisputeStatus] = mapped_column(
        str_enum(DisputeStatus, "dispute_status", 16),
        default=DisputeStatus.OPEN,
        server_default=DisputeStatus.OPEN.value,
        index=True,
    )
    resolution: Mapped[str | None] = mapped_column(Text)
    # Сколько удержано с депозита арендатора в пользу владельца
    damage_amount: Mapped[Decimal | None] = mapped_column(Money)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<Dispute booking={self.booking_id} status={self.status}>"
