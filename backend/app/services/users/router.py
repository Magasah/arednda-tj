import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel, Field

from app.core.cache import CacheDep
from app.core.database import SessionDep
from app.core.limiter import is_bot_request
from app.core.security import CurrentUser
from app.core.storage import StorageDep
from app.services.reviews.trust import trust_key
from app.services.users import service
from app.services.users.schemas import MeResponse, UserProfile

router = APIRouter(prefix="/users", tags=["Users"])

_BINARY = {"type": "string", "format": "binary"}


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Мой профиль",
    description="Профиль, статистика, разбивка trust score и последние отзывы + приватные поля.",
    response_description="Профиль текущего пользователя",
)
async def get_me(user: CurrentUser, session: SessionDep, cache: CacheDep) -> MeResponse:
    return await service.me(session, cache, user)


@router.patch(
    "/me",
    response_model=MeResponse,
    summary="Изменить профиль",
    description="multipart/form-data: name и/или avatar (JPEG/PNG/WebP до 10 МБ → avatars/{id}/).",
    response_description="Обновлённый профиль",
)
async def update_me(
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    cache: CacheDep,
    name: Annotated[str | None, Form(max_length=100, examples=["Фаридун"])] = None,
    avatar: Annotated[UploadFile | None, File(json_schema_extra=_BINARY)] = None,
) -> MeResponse:
    await service.update_me(session, storage, user, name, avatar)
    return await service.me(session, cache, user)


@router.post(
    "/me/verify",
    response_model=MeResponse,
    summary="Подтвердить паспорт (заглушка)",
    description=(
        "Фото паспорта сохраняется в приватное хранилище (наружу не отдаётся). "
        "Сейчас паспорт подтверждается автоматически — в продакшене здесь ручная проверка."
    ),
    response_description="Профиль с is_verified = true",
)
async def verify_passport(
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    cache: CacheDep,
    passport_photo: Annotated[UploadFile, File(json_schema_extra=_BINARY)],
) -> MeResponse:
    await service.verify_passport(session, storage, user, passport_photo)
    await cache.delete(trust_key(user.id))
    return await service.me(session, cache, user)


@router.get(
    "/{user_id}/profile",
    response_model=UserProfile,
    summary="Публичный профиль",
    description=(
        "Без номера телефона: статистика сделок, trust_breakdown, сводка отзывов, "
        "response_rate, до 10 активных объявлений и 5 последних отзывов."
    ),
    response_description="Профиль пользователя",
)
async def get_profile(user_id: uuid.UUID, session: SessionDep, cache: CacheDep) -> UserProfile:
    profile = await service.public_profile(session, cache, user_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")
    return profile


class TelegramLink(BaseModel):
    telegram_id: int = Field(gt=0, examples=[123456789])


@router.post(
    "/me/telegram",
    response_model=MeResponse,
    summary="Привязать Telegram (только бот)",
    description=(
        "Вызывается Telegram-ботом после входа по SMS-коду. Требует заголовок X-Bot-Secret: "
        "telegram_id удостоверяет бот, поэтому обычный клиент привязать его не может. "
        "Если этот Telegram был привязан к другому аккаунту — привязка переносится."
    ),
    response_description="Профиль; уведомления будут приходить в Telegram",
)
async def link_telegram(
    data: TelegramLink, request: Request, user: CurrentUser, session: SessionDep, cache: CacheDep
) -> MeResponse:
    if not is_bot_request(request):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Привязка Telegram доступна только боту")
    await service.link_telegram(session, user, data.telegram_id)
    return await service.me(session, cache, user)


@router.delete(
    "/me/telegram",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Отвязать Telegram",
    description="Уведомления перестанут приходить в Telegram.",
    response_description="Telegram отвязан",
)
async def unlink_telegram(user: CurrentUser, session: SessionDep) -> Response:
    user.telegram_id = None
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
