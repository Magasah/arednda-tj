"""Аналитика платформы для администраторов."""

from decimal import Decimal

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheDep
from app.core.config import settings
from app.core.database import SessionDep
from app.core.security import AdminUser
from app.models import Booking, BookingStatus, Category, Listing, ListingStatus, User

router = APIRouter(prefix="/analytics", tags=["Analytics"])

PLATFORM_KEY = "analytics:platform"
PLATFORM_TTL = 300
TOP = 5


class CategoryStat(BaseModel):
    slug: str
    count: int


class CityStat(BaseModel):
    city: str
    listings_count: int


class PlatformStats(BaseModel):
    total_users: int
    total_listings: int
    total_bookings: int
    completed_bookings: int
    disputed_bookings: int
    total_revenue: Decimal = Field(
        examples=["1250.00"], description="Комиссия платформы с завершённых сделок, сомони"
    )
    commission_percent: int
    top_categories: list[CategoryStat]
    top_cities: list[CityStat]


async def _collect(session: AsyncSession) -> PlatformStats:
    async def count(query: object) -> int:
        return await session.scalar(query) or 0  # type: ignore[arg-type]

    status_counts = dict(
        (await session.execute(select(Booking.status, func.count()).group_by(Booking.status))).all()
    )
    completed_turnover = await session.scalar(
        select(func.coalesce(func.sum(Booking.total_price), 0)).where(
            Booking.status == BookingStatus.COMPLETED
        )
    )
    revenue = (Decimal(completed_turnover) * settings.platform_commission_percent / 100).quantize(
        Decimal("0.01")
    )

    categories = await session.execute(
        select(Category.slug, func.count(Listing.id).label("n"))
        .join(Listing, Listing.category_id == Category.id)
        .where(Listing.status == ListingStatus.ACTIVE)
        .group_by(Category.slug)
        .order_by(func.count(Listing.id).desc(), Category.slug)
        .limit(TOP)
    )
    cities = await session.execute(
        select(Listing.city, func.count(Listing.id))
        .where(Listing.status == ListingStatus.ACTIVE)
        .group_by(Listing.city)
        .order_by(func.count(Listing.id).desc(), Listing.city)
        .limit(TOP)
    )

    return PlatformStats(
        total_users=await count(select(func.count()).select_from(User)),
        total_listings=await count(select(func.count()).select_from(Listing)),
        total_bookings=sum(status_counts.values()),
        completed_bookings=status_counts.get(BookingStatus.COMPLETED, 0),
        disputed_bookings=status_counts.get(BookingStatus.DISPUTED, 0)
        + status_counts.get(BookingStatus.RESOLVED, 0),
        total_revenue=revenue,
        commission_percent=settings.platform_commission_percent,
        top_categories=[CategoryStat(slug=s, count=n) for s, n in categories],
        top_cities=[CityStat(city=c, listings_count=n) for c, n in cities],
    )


@router.get(
    "/platform",
    response_model=PlatformStats,
    summary="Статистика платформы (admin)",
    description=(
        "Пользователи, объявления, сделки, выручка (комиссия 10% с завершённых сделок), "
        "топ категорий и городов. Только role=admin. Кэш 5 минут."
    ),
    response_description="Сводная статистика",
)
async def platform_stats(_: AdminUser, session: SessionDep, cache: CacheDep) -> PlatformStats:
    cached = await cache.get(PLATFORM_KEY)
    if cached is not None:
        return PlatformStats.model_validate(cached)
    result = await _collect(session)
    await cache.set(PLATFORM_KEY, result.model_dump(mode="json"), PLATFORM_TTL)
    return result
