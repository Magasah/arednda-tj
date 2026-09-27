"""Модель пользователя (таблица users)."""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Enum, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDv7PKMixin


class UserRole(StrEnum):
    USER = "user"
    ADMIN = "admin"


class UserLanguage(StrEnum):
    RU = "ru"
    TG = "tg"  # таджикский (ISO 639-1)


class User(UUIDv7PKMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("trust_score >= 1 AND trust_score <= 5", name="trust_score_range"),
        CheckConstraint("phone ~ '^\\+[1-9][0-9]{7,14}$'", name="phone_e164"),
        CheckConstraint("role IN ('user', 'admin')", name="user_role"),
        CheckConstraint("language IN ('ru', 'tg')", name="user_language"),
    )

    # Телефон в формате E.164 (+992XXXXXXXXX) — основной логин
    phone: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(512))

    # Доверие 1.00..5.00 (services/reviews/trust.py); 4.00 — нейтральный старт
    trust_score: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), default=Decimal("4.00"), server_default=text("4.00")
    )
    # Телефон подтверждён через OTP (внутренний флаг: у вошедших всегда true)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    # Паспорт подтверждён — в API это is_verified («Паспорт подтверждён» в профиле)
    passport_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=text("false")
    )
    passport_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Ключ объекта в приватной части хранилища — наружу не отдаётся
    passport_photo_key: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))

    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            native_enum=False,
            length=16,
            values_callable=lambda e: [m.value for m in e],
        ),
        default=UserRole.USER,
        server_default=UserRole.USER.value,
    )
    language: Mapped[UserLanguage] = mapped_column(
        Enum(
            UserLanguage,
            name="user_language",
            native_enum=False,
            length=2,
            values_callable=lambda e: [m.value for m in e],
        ),
        default=UserLanguage.RU,
        server_default=UserLanguage.RU.value,
    )

    # Привязка к Telegram-боту (aiogram)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    def __repr__(self) -> str:
        return f"<User id={self.id} phone={self.phone}>"
