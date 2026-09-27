"""Категории вещей (таблица categories)."""

from sqlalchemy import Identity, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    name_ru: Mapped[str] = mapped_column(String(100))
    name_tj: Mapped[str] = mapped_column(String(100))
    # Имя SVG-иконки из web/public/svgicons/kiroya (например, kiroya-laptop)
    icon: Mapped[str] = mapped_column(String(64))

    def __repr__(self) -> str:
        return f"<Category {self.slug}>"
