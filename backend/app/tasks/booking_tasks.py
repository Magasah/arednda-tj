"""Фоновые задачи бронирования: автоотмена, напоминания, автоподтверждение возврата."""

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import listing_key
from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.logging import logger
from app.models import Booking, BookingStatus, User
from app.services.booking import service
from app.services.booking.schemas import ConfirmReturnRequest
from app.services.notifications import service as notifications
from app.services.notifications.service import notifier
from app.tasks.dispatch import enqueue
from app.tasks.runtime import run, task_resources


async def _notify_user(session: AsyncSession, user_id: uuid.UUID, message: str) -> None:
    user = await session.get(User, user_id)
    if user is not None:
        await notifier.deliver(user.id, user.telegram_id, message)


async def _cancel_expired() -> int:
    async with task_resources() as (session, cache):
        cancelled = await service.cancel_expired_pending(session)
        text = notifications.BOOKING_CANCELLED
        for booking, listing in cancelled:
            await cache.delete(listing_key(listing.id))
            await _notify_user(
                session,
                booking.renter_id,
                notifications.render(
                    text,
                    listing_title=listing.title,
                    minutes=settings.booking_payment_ttl_minutes,
                ),
            )
    if cancelled:
        logger.info("bookings_auto_cancelled", count=len(cancelled))
    return len(cancelled)


async def _cancel_one(booking_id: str) -> bool:
    async with task_resources() as (session, _):
        status = await session.scalar(
            select(Booking.status).where(Booking.id == uuid.UUID(booking_id))
        )
        if status != BookingStatus.PENDING:
            return False
    # Та же логика и блокировки, что у периодической задачи
    return await _cancel_expired() > 0


async def _return_reminders() -> int:
    async with task_resources() as (session, _):
        due = await service.returns_due_tomorrow(session)
        for booking, listing in due:
            await _notify_user(
                session,
                booking.renter_id,
                notifications.render(
                    notifications.RETURN_REMINDER,
                    listing_title=listing.title,
                    end_date=booking.end_date.strftime("%d.%m.%Y"),
                ),
            )
    return len(due)


async def _auto_confirm() -> int:
    confirmed = 0
    async with task_resources() as (session, cache):
        for booking_id in await service.overdue_return_pending_ids(session):
            try:
                # Владелец молчит 48 ч — защищаем арендатора: возврат считается принятым
                result = await service.confirm_return(
                    session, booking_id, None, ConfirmReturnRequest(condition="good")
                )
            except HTTPException as exc:
                await session.rollback()  # снимаем блокировку строки перед следующей бронью
                # Статус уже сменился параллельно (владелец успел подтвердить) — пропускаем
                logger.info("auto_confirm_skipped", booking_id=str(booking_id), reason=exc.detail)
                continue
            confirmed += 1
            await cache.delete(listing_key(result.listing.id))
            enqueue(
                "app.tasks.review_tasks.send_review_reminder",
                result.booking.id,
                countdown=settings.review_reminder_delay_seconds,
            )
    if confirmed:
        logger.info("returns_auto_confirmed", count=confirmed)
    return confirmed


@celery_app.task(name="app.tasks.booking_tasks.cancel_expired_bookings")
def cancel_expired_bookings() -> int:
    return run(_cancel_expired)


@celery_app.task(name="app.tasks.booking_tasks.cancel_booking_if_unpaid")
def cancel_booking_if_unpaid(booking_id: str) -> bool:
    return run(lambda: _cancel_one(booking_id))


@celery_app.task(name="app.tasks.booking_tasks.send_return_reminder")
def send_return_reminder() -> int:
    return run(_return_reminders)


@celery_app.task(name="app.tasks.booking_tasks.auto_confirm_return")
def auto_confirm_return() -> int:
    return run(_auto_confirm)
