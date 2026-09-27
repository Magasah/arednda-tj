"""Celery: брокер и результаты — Redis, расписание периодических задач (beat).

Запуск:
    celery -A app.core.celery_app worker --loglevel=info --concurrency=2
    celery -A app.core.celery_app beat --loglevel=info
    (Windows без Docker: worker ... --pool=solo)
"""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "kiroya",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.booking_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.review_tasks",
    ],
)

celery_app.conf.update(
    timezone=settings.celery_timezone,
    enable_utc=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=24 * 3600,
    # Задача подтверждается после выполнения: падение воркера не теряет её
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_time_limit=120,
    task_soft_time_limit=100,
    broker_connection_retry_on_startup=True,
    # Для Redis-брокера: отложенные (countdown) задачи дольше этого времени
    # переотдаются другому воркеру — берём с запасом больше самой длинной задержки
    broker_transport_options={"visibility_timeout": 6 * 3600},
    beat_schedule={
        "cancel-expired-bookings": {
            "task": "app.tasks.booking_tasks.cancel_expired_bookings",
            "schedule": 300.0,  # каждые 5 минут
        },
        "auto-confirm-returns": {
            "task": "app.tasks.booking_tasks.auto_confirm_return",
            "schedule": 900.0,  # каждые 15 минут
        },
        "recalculate-trust-scores": {
            "task": "app.tasks.review_tasks.recalculate_all_trust_scores",
            # 03:00 по Душанбе. timezone=Asia/Dushanbe — crontab в местном времени,
            # поэтому hour=3 (а не 22: это было бы 22:00 по Душанбе)
            "schedule": crontab(hour=3, minute=0),
        },
        "send-return-reminders": {
            "task": "app.tasks.booking_tasks.send_return_reminder",
            # Раз в день в 10:00 по Душанбе — напоминание тем, у кого возврат завтра
            "schedule": crontab(hour=10, minute=0),
        },
    },
)

app = celery_app
