"""Общие Pydantic-типы для всех сервисов."""

import re
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


def _normalize_phone(value: str) -> str:
    """Приводит номер к E.164. Местный формат 9 цифр → +992 (Таджикистан)."""
    digits = re.sub(r"[^\d+]", "", value)
    if re.fullmatch(r"\d{9}", digits):
        digits = f"+992{digits}"
    elif digits.startswith("992") and len(digits) == 12:
        digits = f"+{digits}"
    if not _E164.fullmatch(digits):
        raise ValueError("Номер телефона в формате +992XXXXXXXXX")
    return digits


def _require_tajik(value: str) -> str:
    if not (value.startswith("+992") and len(value) == 13):
        raise ValueError("Нужен таджикский номер: +992 и 9 цифр")
    return value


Phone = Annotated[str, AfterValidator(_normalize_phone)]

# Номер Таджикистана: +992XXXXXXXXX (13 символов). Местный формат 9 цифр допускается
TjPhone = Annotated[str, AfterValidator(_normalize_phone), AfterValidator(_require_tajik)]

# Сумма в сомони: неотрицательная, 2 знака после запятой
Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int
