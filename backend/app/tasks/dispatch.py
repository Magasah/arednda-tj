"""Постановка задач в Celery из API без импорта модулей задач (нет циклических импортов).

Ошибка брокера не должна ломать пользовательский запрос: логируем и продолжаем —
периодические задачи (beat) подстрахуют.
"""

import uuid
from typing import Any

from kombu.exceptions import OperationalError

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.logging import logger


def enqueue(task_name: str, *args: Any, countdown: int = 0) -> None:
    if not settings.celery_enabled:
        logger.info("celery_disabled_skip", task=task_name)
        return
    try:
        celery_app.send_task(
            task_name,
            args=[str(a) if isinstance(a, uuid.UUID) else a for a in args],
            countdown=countdown,
            retry=False,
        )
    except (OperationalError, OSError) as exc:
        logger.warning("celery_enqueue_failed", task=task_name, error=str(exc))
