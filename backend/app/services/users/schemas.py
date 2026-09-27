import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.user import UserLanguage
from app.services.listings.schemas import ListingCard, UserShort
from app.services.reviews.trust import TrustBreakdown


class UserStats(BaseModel):
    total_deals: int = Field(description="Завершённые сделки (как владелец и как арендатор)")
    disputes: int = Field(description="Сделки, дошедшие до спора")
    return_rate_percent: float | None = Field(
        description="Доля аренд, где вещь возвращена без спора (как арендатор); null — нет сделок",
        examples=[98.5],
    )


class ReviewsSummary(BaseModel):
    total: int
    avg: float | None = Field(examples=[4.8])
    distribution: dict[int, int] = Field(examples=[{1: 0, 2: 0, 3: 1, 4: 3, 5: 20}])


class ReviewShort(BaseModel):
    id: uuid.UUID
    rating: int = Field(examples=[5])
    text: str | None
    author_name: str | None
    created_at: datetime


class UserProfile(BaseModel):
    user: UserShort
    stats: UserStats
    trust_breakdown: TrustBreakdown
    reviews_summary: ReviewsSummary
    response_rate: float | None = Field(
        description="% возвратов, подтверждённых владельцем в течение 24 ч; null — нет данных",
        examples=[95.0],
    )
    active_listings: list[ListingCard]
    recent_reviews: list[ReviewShort]


class MeResponse(UserProfile):
    """Свой профиль: публичные данные + приватные поля."""

    phone: str
    language: UserLanguage
    passport_verified_at: datetime | None
    trust_score: Decimal = Field(examples=["4.80"], description="Сохранённый trust score 1..5")
    telegram_linked: bool = Field(description="Уведомления приходят в Telegram-бот")
