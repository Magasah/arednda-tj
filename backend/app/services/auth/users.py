"""Доступ к пользователям для auth. Отдельный слой — в unit-тестах подменяется in-memory."""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


async def get_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await session.get(User, user_id)


async def get_by_phone(session: AsyncSession, phone: str) -> User | None:
    return await session.scalar(select(User).where(User.phone == phone))


async def get_or_create_verified(session: AsyncSession, phone: str) -> tuple[User, bool]:
    """Возвращает (пользователь, создан_ли). Номер подтверждён OTP → verified=True."""
    user = await get_by_phone(session, phone)
    created = user is None
    if user is None:
        user = User(phone=phone, verified=True)
        session.add(user)
    elif not user.verified:
        user.verified = True

    try:
        await session.commit()
    except IntegrityError:
        # Параллельный вход с того же номера успел создать пользователя
        await session.rollback()
        user = await get_by_phone(session, phone)
        if user is None:
            raise
        return user, False

    await session.refresh(user)
    return user, created
