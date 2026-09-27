"""Заполняет таблицу categories. Идемпотентно: повторный запуск обновляет, а не дублирует.

Запуск из папки backend:
    uv run python scripts/seed_categories.py
    uv run python -m scripts.seed_categories
"""

import asyncio
import sys
from pathlib import Path

# Прямой запуск файлом: добавляем backend/ в путь импорта, чтобы находился пакет app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.core.database import SessionFactory, engine
from app.models import Category

CATEGORIES = [
    {"slug": "tech", "name_ru": "Техника", "name_tj": "Техника", "icon": "kiroya-laptop"},
    {"slug": "tools", "name_ru": "Инструменты", "name_tj": "Асбобҳо", "icon": "kiroya-wrench"},
    {"slug": "transport", "name_ru": "Транспорт", "name_tj": "Нақлиёт", "icon": "kiroya-scooter"},
    {"slug": "events", "name_ru": "Мероприятия", "name_tj": "Тадбирҳо", "icon": "kiroya-tent"},
    {"slug": "photo", "name_ru": "Фото и видео", "name_tj": "Аксбардорӣ", "icon": "kiroya-camera"},
]


async def seed() -> int:
    statement = insert(Category).values(CATEGORIES)
    statement = statement.on_conflict_do_update(
        index_elements=[Category.slug],
        set_={
            "name_ru": statement.excluded.name_ru,
            "name_tj": statement.excluded.name_tj,
            "icon": statement.excluded.icon,
        },
    )
    async with SessionFactory() as session, session.begin():
        await session.execute(statement)
        total = await session.scalar(select(func.count()).select_from(Category))
    await engine.dispose()
    return total or 0


if __name__ == "__main__":
    count = asyncio.run(seed())
    print(f"Категорий в БД: {count}")
