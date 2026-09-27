"""Статистика пользователя: сделки, споры, возвраты, отзывы. Только чтение."""

import uuid
from dataclasses import dataclass, field
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Booking,
    BookingStatus,
    Dispute,
    DisputeStatus,
    HandoverRecord,
    Listing,
    Review,
)

DISPUTE_STATUSES = (BookingStatus.DISPUTED, BookingStatus.RESOLVED)


def _owned(user_id: uuid.UUID) -> object:
    return select(Listing.id).where(Listing.owner_id == user_id).scalar_subquery()


async def total_deals(session: AsyncSession, user_id: uuid.UUID) -> int:
    """Завершённые сделки — как арендатор и как владелец."""
    count = await session.scalar(
        select(func.count(Booking.id)).where(
            Booking.status == BookingStatus.COMPLETED,
            or_(Booking.renter_id == user_id, Booking.listing_id.in_(_owned(user_id))),
        )
    )
    return count or 0


async def disputes_count(session: AsyncSession, user_id: uuid.UUID) -> int:
    count = await session.scalar(
        select(func.count(Booking.id)).where(
            or_(Booking.renter_id == user_id, Booking.listing_id.in_(_owned(user_id))),
            Booking.status.in_(DISPUTE_STATUSES),
        )
    )
    return count or 0


async def return_rate(session: AsyncSession, user_id: uuid.UUID) -> float | None:
    """Доля аренд (как арендатор), где вещь вернули без спора. None — сделок ещё нет."""
    completed, disputed = (
        await session.execute(
            select(
                func.count().filter(Booking.status == BookingStatus.COMPLETED),
                func.count().filter(Booking.status.in_(DISPUTE_STATUSES)),
            ).where(Booking.renter_id == user_id)
        )
    ).one()
    finished = completed + disputed
    return round(completed * 100 / finished, 1) if finished else None


async def response_rate(session: AsyncSession, user_id: uuid.UUID) -> float | None:
    """% возвратов, которые владелец подтвердил сам в течение 24 ч (а не автоподтверждение).

    У владельца в сделке нет шага «принять бронь», поэтому его реакция измеряется
    по подтверждению возврата. None — возвратов по его вещам ещё не было.
    """
    confirmed, fast = (
        await session.execute(
            select(
                func.count(),
                func.count().filter(
                    Booking.completed_at <= HandoverRecord.return_at + timedelta(hours=24)
                ),
            )
            .select_from(Booking)
            .join(HandoverRecord, HandoverRecord.booking_id == Booking.id)
            .where(
                Booking.listing_id.in_(_owned(user_id)),
                HandoverRecord.return_at.is_not(None),
                Booking.completed_at.is_not(None),
            )
        )
    ).one()
    return round(fast * 100 / confirmed, 1) if confirmed else None


@dataclass
class DisputePenalties:
    open_disputes: int
    resolved_with_damage: int


async def dispute_penalties(session: AsyncSession, user_id: uuid.UUID) -> DisputePenalties:
    """Споры, где пользователь — арендатор (сторона, к которой предъявлена претензия)."""
    open_count, damaged = (
        await session.execute(
            select(
                func.count().filter(Dispute.status == DisputeStatus.OPEN),
                func.count().filter(
                    and_(Dispute.status == DisputeStatus.RESOLVED, Dispute.damage_amount > 0)
                ),
            )
            .select_from(Dispute)
            .join(Booking, Booking.id == Dispute.booking_id)
            .where(Booking.renter_id == user_id)
        )
    ).one()
    return DisputePenalties(open_count, damaged)


@dataclass
class ReviewsSummary:
    total: int
    avg: float | None
    distribution: dict[int, int] = field(default_factory=lambda: dict.fromkeys(range(1, 6), 0))
    hidden: int = 0


def visible_reviews() -> object:
    return and_(Review.is_hidden.is_(False), Review.is_deleted.is_(False))


async def reviews_summary(session: AsyncSession, user_id: uuid.UUID) -> ReviewsSummary:
    """Полученные отзывы: видимые (для рейтинга) и число скрытых антифродом."""
    rows = await session.execute(
        select(Review.rating, func.count())
        .where(Review.to_user_id == user_id, visible_reviews())
        .group_by(Review.rating)
    )
    summary = ReviewsSummary(total=0, avg=None)
    weighted = 0
    for rating, count in rows:
        summary.distribution[rating] = count
        summary.total += count
        weighted += rating * count
    if summary.total:
        summary.avg = round(weighted / summary.total, 2)

    summary.hidden = (
        await session.scalar(
            select(func.count()).where(
                Review.to_user_id == user_id,
                Review.is_hidden.is_(True),
                Review.is_deleted.is_(False),
            )
        )
        or 0
    )
    return summary


def money(value: Decimal | float | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))
