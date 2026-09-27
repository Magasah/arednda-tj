"""Отзывы (таблица reviews)."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDv7PKMixin


class Review(UUIDv7PKMixin, Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),
        CheckConstraint("fraud_score BETWEEN 0 AND 1", name="fraud_score_range"),
        CheckConstraint("from_user_id <> to_user_id", name="not_self"),
        # По одной оценке от каждой стороны сделки: арендатор → владелец и обратно
        UniqueConstraint("booking_id", "from_user_id", name="uq_reviews_booking_id_from_user_id"),
    )

    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="RESTRICT"))
    from_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    rating: Mapped[int] = mapped_column(SmallInteger)
    text: Mapped[str | None] = mapped_column(Text)
    # Вероятность фейка 0..1 от ML-антифрода
    fraud_score: Mapped[float] = mapped_column(Float, default=0.0, server_default=sql_text("0"))
    # fraud_score >= 0.7 → скрыт из публичного API (services/reviews/fraud.py)
    is_hidden: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=sql_text("false")
    )
    # Мягкое удаление автором (в течение 24 ч)
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=sql_text("false")
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<Review booking={self.booking_id} rating={self.rating}>"
