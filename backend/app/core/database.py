"""Подключение к PostgreSQL через async SQLAlchemy 2.0 + asyncpg."""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.models.base import Base

__all__ = ["Base", "SessionDep", "SessionFactory", "check_database", "engine", "get_db"]

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_recycle=settings.db_pool_recycle,
    pool_pre_ping=True,
    connect_args={
        # Имя приложения видно в pg_stat_activity — удобно для мониторинга
        "server_settings": {"application_name": "kiroya-backend"},
        # Защита от зависших запросов (мс)
        "command_timeout": 30,
    },
)

SessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI-зависимость: одна сессия на запрос, откат при исключении."""
    async with SessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# Имя из ТЗ; get_session оставлен для обратной совместимости
get_db = get_session

SessionDep = Annotated[AsyncSession, Depends(get_db)]


async def check_database() -> bool:
    """Проверка доступности БД для readiness-пробы."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        return False
    return True
