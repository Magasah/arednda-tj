"""Отложенные уведомления."""

import uuid

from app.core.celery_app import celery_app
from app.models import User
from app.services.notifications.service import notifier
from app.tasks.runtime import run, task_resources


async def _send(user_id: str, message: str) -> None:
    async with task_resources() as (session, _):
        user = await session.get(User, uuid.UUID(user_id))
    if user is not None:
        await notifier.deliver(user.id, user.telegram_id, message)


@celery_app.task(name="app.tasks.notification_tasks.send_notification")
def send_notification(user_id: str, message: str) -> None:
    run(lambda: _send(user_id, message))
