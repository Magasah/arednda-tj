"""Время: в БД — UTC, «сегодня» для сроков аренды — по часовому поясу Душанбе."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings

LOCAL_TZ = ZoneInfo(settings.celery_timezone)


def utcnow() -> datetime:
    return datetime.now(UTC)


def local_today(now: datetime | None = None) -> date:
    return (now or utcnow()).astimezone(LOCAL_TZ).date()
