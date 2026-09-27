"""Отзывы и доверие: напоминание оставить отзыв, ночной пересчёт trust score."""

import uuid
from datetime import timedelta

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.logging import logger
from app.core.timeutils import utcnow
from app.models import Booking, BookingStatus, Listing, Review, User
from app.services.notifications import service as notifications
from app.services.notifications.service import notifier
from app.services.reviews.trust import recalculate_trust_score, trust_key
from app.tasks.runtime import run, task_resources


async def _review_reminder(booking_id: str) -> int:
    async with task_resources() as (session, _):
        row = (
            await session.execute(
                select(Booking, Listing.owner_id)
                .join(Listing, Listing.id == Booking.listing_id)
                .where(Booking.id == uuid.UUID(booking_id))
            )
        ).one_or_none()
        if row is None or row[0].status != BookingStatus.COMPLETED:
            return 0
        booking, owner_id = row
        if booking.completed_at and utcnow() - booking.completed_at > timedelta(
            days=settings.review_deadline_days
        ):
            return 0

        reviewed = set(
            await session.scalars(
                select(Review.from_user_id).where(Review.booking_id == booking.id)
            )
        )
        sent = 0
        for user_id in {booking.renter_id, owner_id} - reviewed:
            user = await session.get(User, user_id)
            if user is not None:
                await notifier.deliver(user.id, user.telegram_id, notifications.REVIEW_REMINDER)
                sent += 1
    return sent


async def _recalculate_recent() -> int:
    since = utcnow() - timedelta(hours=24)
    async with task_resources() as (session, cache):
        user_ids = list(
            await session.scalars(
                select(Review.to_user_id.distinct())
                .join(User, User.id == Review.to_user_id)
                .where(Review.created_at >= since, User.is_active.is_(True))
            )
        )
        for user_id in user_ids:
            await recalculate_trust_score(user_id, session)
        await session.commit()
        for user_id in user_ids:
            await cache.delete(trust_key(user_id))
    logger.info("trust_scores_recalculated", count=len(user_ids))
    return len(user_ids)


@celery_app.task(name="app.tasks.review_tasks.send_review_reminder")
def send_review_reminder(booking_id: str) -> int:
    """Через 2 часа после завершения: напомнить тем участникам, кто ещё не оставил отзыв."""
    return run(lambda: _review_reminder(booking_id))


@celery_app.task(name="app.tasks.review_tasks.recalculate_all_trust_scores")
def recalculate_all_trust_scores() -> int:
    """Ночной пересчёт trust score у активных пользователей с новыми отзывами за 24 ч."""
    return run(_recalculate_recent)
