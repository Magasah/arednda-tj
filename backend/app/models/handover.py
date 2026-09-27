"""Фото-акт передачи и возврата вещи (таблица handovers)."""

import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDv7PKMixin


class HandoverRecord(UUIDv7PKMixin, TimestampMixin, Base):
    __tablename__ = "handovers"

    # Один фото-акт на бронирование
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="RESTRICT"), unique=True
    )
    photos_before: Mapped[list[str]] = mapped_column(
        ARRAY(String(512)), server_default=text("'{}'::varchar[]")
    )
    photos_after: Mapped[list[str] | None] = mapped_column(ARRAY(String(512)))
    qr_code: Mapped[str | None] = mapped_column(String(128))
    handover_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Когда арендатор вернул вещь — от этого момента считается автоподтверждение
    return_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    def __repr__(self) -> str:
        return f"<HandoverRecord booking={self.booking_id}>"
