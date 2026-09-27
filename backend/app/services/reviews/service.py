"""Отзывы: создание после завершённой сделки, антифрод, пересчёт доверия, публичные списки."""

import math
import uuid
from datetime import timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.timeutils import utcnow
from app.models import Booking, BookingStatus, Listing, Review, User
from app.services.reviews.fraud import FraudDetector
from app.services.reviews.schemas import ReviewAuthor, ReviewCreate, ReviewItem, ReviewPage
from app.services.reviews.trust import recalculate_trust_score
from app.services.users import stats


def _http(code: int, detail: str) -> HTTPException:
    return HTTPException(code, detail)


async def create_review(
    session: AsyncSession, author: User, data: ReviewCreate
) -> tuple[Review, set[uuid.UUID]]:
    """Возвращает отзыв и id пользователей, чей trust score пересчитан."""
    row = (
        await session.execute(
            select(Booking, Listing)
            .join(Listing, Listing.id == Booking.listing_id)
            .where(Booking.id == data.booking_id)
        )
    ).one_or_none()
    if row is None:
        raise _http(status.HTTP_404_NOT_FOUND, "Бронь не найдена")
    booking, listing = row

    if author.id not in (booking.renter_id, listing.owner_id):
        raise _http(status.HTTP_403_FORBIDDEN, "Отзыв может оставить только участник сделки")
    if booking.status != BookingStatus.COMPLETED:
        raise _http(
            status.HTTP_403_FORBIDDEN, "Отзыв можно оставить только после завершения сделки"
        )

    now = utcnow()
    completed_at = booking.completed_at or booking.updated_at
    if now - completed_at > timedelta(days=settings.review_deadline_days):
        raise _http(
            status.HTTP_403_FORBIDDEN,
            f"Отзыв можно оставить в течение {settings.review_deadline_days} дней после сделки",
        )

    already = await session.scalar(
        select(Review.id).where(Review.booking_id == booking.id, Review.from_user_id == author.id)
    )
    if already is not None:
        raise _http(status.HTTP_409_CONFLICT, "Вы уже оставили отзыв по этой сделке")

    to_user_id = listing.owner_id if author.id == booking.renter_id else booking.renter_id
    review = Review(
        booking_id=booking.id,
        from_user_id=author.id,
        to_user_id=to_user_id,
        rating=data.rating,
        text=(data.text or "").strip() or None,
        created_at=now,
    )
    session.add(review)
    try:
        await session.flush()
    except IntegrityError as exc:
        # Параллельный повторный запрос: unique(booking_id, from_user_id)
        await session.rollback()
        raise _http(status.HTTP_409_CONFLICT, "Вы уже оставили отзыв по этой сделке") from exc

    await FraudDetector().check(review, session)

    # Антифрод мог скрыть и встречный отзыв — пересчитываем обоих участников
    affected = {to_user_id, author.id}
    for user_id in affected:
        await recalculate_trust_score(user_id, session)
    await session.commit()
    return review, affected


async def delete_review(session: AsyncSession, review_id: uuid.UUID, user: User) -> uuid.UUID:
    review = await session.scalar(select(Review).where(Review.id == review_id).with_for_update())
    if review is None or review.is_deleted:
        raise _http(status.HTTP_404_NOT_FOUND, "Отзыв не найден")
    if review.from_user_id != user.id:
        raise _http(status.HTTP_403_FORBIDDEN, "Удалить отзыв может только автор")
    if utcnow() - review.created_at > timedelta(hours=settings.review_delete_hours):
        raise _http(
            status.HTTP_403_FORBIDDEN,
            f"Отзыв можно удалить только в течение {settings.review_delete_hours} часов",
        )

    review.is_deleted = True
    review.deleted_at = utcnow()
    await session.flush()
    await recalculate_trust_score(review.to_user_id, session)
    await session.commit()
    return review.to_user_id


def _item(row: Any) -> ReviewItem:
    review: Review = row.Review
    return ReviewItem(
        id=review.id,
        rating=review.rating,
        text=review.text,
        author=ReviewAuthor(id=row.author_id, name=row.author_name, avatar_url=row.author_avatar),
        listing_title=row.listing_title,
        about_role="owner" if review.to_user_id == row.owner_id else "renter",
        created_at=review.created_at,
    )


def _public_query() -> Any:
    author = User.__table__.alias("author")
    return (
        select(
            Review,
            author.c.id.label("author_id"),
            author.c.name.label("author_name"),
            author.c.avatar_url.label("author_avatar"),
            Listing.title.label("listing_title"),
            Listing.owner_id.label("owner_id"),
        )
        .join(author, author.c.id == Review.from_user_id)
        .join(Booking, Booking.id == Review.booking_id)
        .join(Listing, Listing.id == Booking.listing_id)
        .where(stats.visible_reviews())
    )


async def _page(
    session: AsyncSession, query: Any, page: int, limit: int
) -> tuple[list[ReviewItem], int]:
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.execute(
        query.order_by(Review.created_at.desc()).limit(limit).offset((page - 1) * limit)
    )
    return [_item(r) for r in rows], total


async def user_reviews(
    session: AsyncSession, user_id: uuid.UUID, page: int, limit: int
) -> ReviewPage:
    items, total = await _page(
        session, _public_query().where(Review.to_user_id == user_id), page, limit
    )
    summary = await stats.reviews_summary(session, user_id)
    return ReviewPage(
        items=items,
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
        avg_rating=summary.avg,
        rating_distribution=summary.distribution,
    )


async def listing_renter_reviews(
    session: AsyncSession, listing_id: uuid.UUID, page: int, limit: int
) -> ReviewPage:
    """Отзывы владельца об арендаторах этой вещи."""
    query = _public_query().where(
        Booking.listing_id == listing_id, Review.to_user_id == Booking.renter_id
    )
    items, total = await _page(session, query, page, limit)

    distribution = dict.fromkeys(range(1, 6), 0)
    rows = await session.execute(
        select(Review.rating, func.count())
        .join(Booking, Booking.id == Review.booking_id)
        .where(
            Booking.listing_id == listing_id,
            Review.to_user_id == Booking.renter_id,
            stats.visible_reviews(),
        )
        .group_by(Review.rating)
    )
    distribution.update(dict(rows.all()))
    count = sum(distribution.values())
    avg = round(sum(r * n for r, n in distribution.items()) / count, 2) if count else None
    return ReviewPage(
        items=items,
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total else 0,
        avg_rating=avg,
        rating_distribution=distribution,
    )
