"""Точка входа FastAPI."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import check_database, engine
from app.core.limiter import limiter
from app.core.logging import logger, setup_logging
from app.core.middleware import RequestIDMiddleware
from app.core.redis import redis_client
from app.core.storage import LOCAL_URL_PREFIX, storage


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    db_ok = await check_database()
    # Не падаем, если БД ещё поднимается: /health покажет состояние, pool переподключится
    log = logger.info if db_ok else logger.error
    log("startup", environment=settings.environment, db="connected" if db_ok else "unavailable")
    # Бакет для фото: создаётся при первом старте; на dev MinIO может отсутствовать
    await storage.ensure_bucket()
    yield
    # Корректно закрываем пулы соединений
    await engine.dispose()
    await redis_client.aclose(close_connection_pool=True)
    logger.info("shutdown")


API_DESCRIPTION = """
# KIROYA API
Первая P2P платформа аренды вещей в Таджикистане.

## Аутентификация
Используй Bearer токен: `POST /auth/send-otp` → `POST /auth/verify-otp` → токен.
Нажми **Authorize** и вставь `access_token`.

## Эскроу
Деньги заморожены до подтверждения возврата обеими сторонами.
"""

OPENAPI_TAGS = [
    {"name": "Auth", "description": "Вход по номеру телефона: SMS-код, JWT"},
    {"name": "Listings", "description": "Объявления, фото, геопоиск"},
    {"name": "Booking", "description": "Бронь → оплата → передача → возврат"},
    {"name": "Escrow", "description": "Заморозка и выплата средств"},
    {"name": "Reviews", "description": "Отзывы, антифрод"},
    {"name": "Users", "description": "Профили, trust score, верификация"},
    {"name": "Analytics", "description": "Статистика платформы (admin)"},
]


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=API_DESCRIPTION,
        openapi_tags=OPENAPI_TAGS,
        lifespan=lifespan,
        # В проде документация API скрыта
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else f"{settings.api_v1_prefix}/openapi.json",
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    app.add_middleware(RequestIDMiddleware)

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    if settings.is_dev:
        # Локальный фолбэк хранилища фото (когда MinIO недоступен)
        try:
            storage.local_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            logger.warning("local_uploads_unavailable", path=str(storage.local_dir), error=str(exc))
        else:
            app.mount(LOCAL_URL_PREFIX, StaticFiles(directory=storage.local_dir), name="uploads")

    @app.get("/health", tags=["Health"], summary="Состояние API и БД")
    async def health(response: Response) -> dict[str, str]:
        if await check_database():
            return {"status": "ok", "db": "connected"}
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "degraded", "db": "disconnected"}

    return app


app = create_app()
