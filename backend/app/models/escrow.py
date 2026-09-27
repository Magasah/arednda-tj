"""Эскроу-транзакции (таблица escrow_txns).

Изменение логики эскроу — только после ревью команды (AI_RULES).
"""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Money, TimestampMixin, UUIDv7PKMixin, str_enum


class EscrowStatus(StrEnum):
    FROZEN = "frozen"
    RELEASED = "released"
    RETURNED = "returned"
    PARTIAL_RETURNED = "partial_returned"


class EscrowTransaction(UUIDv7PKMixin, TimestampMixin, Base):
    __tablename__ = "escrow_txns"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="amount_non_negative"),
        CheckConstraint("deposit >= 0", name="deposit_non_negative"),
        CheckConstraint("payout_amount >= 0", name="payout_non_negative"),
        CheckConstraint("deposit_refund_amount >= 0", name="refund_non_negative"),
    )

    # Одна эскроу-транзакция на бронирование
    booking_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="RESTRICT"), unique=True
    )
    amount: Mapped[Decimal] = mapped_column(Money)
    deposit: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[EscrowStatus] = mapped_column(
        str_enum(EscrowStatus, "escrow_status", 20),
        default=EscrowStatus.FROZEN,
        server_default=EscrowStatus.FROZEN.value,
    )
    provider: Mapped[str] = mapped_column(String(32), default="alif", server_default="alif")
    # ID операции у платёжного провайдера; unique — защита от двойной обработки
    provider_tx_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    frozen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Итог расчёта: сколько получил владелец и сколько депозита вернулось арендатору
    payout_amount: Mapped[Decimal | None] = mapped_column(Money)
    deposit_refund_amount: Mapped[Decimal | None] = mapped_column(Money)
    deposit_returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<EscrowTransaction booking={self.booking_id} status={self.status}>"
