"""Профили пользователей: публичный профиль, свой профиль, аватар, верификация паспорта."""

import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService
from app.core.logging import logger
from app.core.storage import StorageService
from app.core.timeutils import utcnow
from app.models import Listing, ListingStatus, Review, User
from app.services.listings.schemas import ListingCard
from app.services.listings.service import card_fields, card_query, user_short
from app.services.reviews.trust import (
    TRUST_TTL,
    TrustBreakdown,
    compute_breakdown,
    recalculate_trust_score,
    trust_key,
)
from app.services.users import stats
from app.services.users.schemas import (
    MeResponse,
    ReviewShort,
    ReviewsSummary,
    UserProfile,
    UserStats,
)


async def trust_breakdown(session: AsyncSession, cache: CacheService, user: User) -> TrustBreakdown:
    """Из кэша trust:{id} (TTL 1 ч) или расчётом — без записи в БД."""
    cached = await cache.get(trust_key(user.id))
    if cached is not None:
        return TrustBreakdown.model_validate(cached)
    breakdown = await compute_breakdown(session, user)
    await cache.set(trust_key(user.id), breakdown.model_dump(), TRUST_TTL)
    return breakdown


async def _profile_parts(
    session: AsyncSession, cache: CacheService, user: User
) -> dict[str, object]:
    rows = await session.execute(
        card_query()
        .where(Listing.owner_id == user.id, Listing.status == ListingStatus.ACTIVE)
        .order_by(Listing.created_at.desc())
        .limit(10)
    )
    author = User.__table__.alias("author")
    review_rows = await session.execute(
        select(Review.id, Review.rating, Review.text, Review.created_at, author.c.name)
        .join(author, author.c.id == Review.from_user_id)
        .where(Review.to_user_id == user.id, stats.visible_reviews())
        .order_by(Review.created_at.desc())
        .limit(5)
    )
    summary = await stats.reviews_summary(session, user.id)
    short = await user_short(session, user)
    return {
        "user": short,
        "stats": UserStats(
            total_deals=short.total_deals,
            disputes=await stats.disputes_count(session, user.id),
            return_rate_percent=await stats.return_rate(session, user.id),
        ),
        "trust_breakdown": await trust_breakdown(session, cache, user),
        "reviews_summary": ReviewsSummary(
            total=summary.total, avg=summary.avg, distribution=summary.distribution
        ),
        "response_rate": await stats.response_rate(session, user.id),
        "active_listings": [ListingCard(**card_fields(row)) for row in rows],
        "recent_reviews": [
            ReviewShort(
                id=r.id, rating=r.rating, text=r.text, author_name=r.name, created_at=r.created_at
            )
            for r in review_rows
        ],
    }


async def public_profile(
    session: AsyncSession, cache: CacheService, user_id: uuid.UUID
) -> UserProfile | None:
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return UserProfile(**await _profile_parts(session, cache, user))  # type: ignore[arg-type]


async def me(session: AsyncSession, cache: CacheService, user: User) -> MeResponse:
    return MeResponse(
        **await _profile_parts(session, cache, user),  # type: ignore[arg-type]
        phone=user.phone,
        language=user.language,
        passport_verified_at=user.passport_verified_at,
        trust_score=user.trust_score,
        telegram_linked=user.telegram_id is not None,
    )


async def update_me(
    session: AsyncSession,
    storage: StorageService,
    user: User,
    name: str | None,
    avatar: UploadFile | None,
) -> None:
    if name is None and avatar is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Передайте name или avatar")

    old_avatar = user.avatar_url
    if name is not None:
        cleaned = " ".join(name.split())
        if not 1 <= len(cleaned) <= 100:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Имя: от 1 до 100 символов")
        user.name = cleaned
    if avatar is not None:
        user.avatar_url = await storage.upload_file(avatar, f"avatars/{user.id}")

    await session.commit()
    if avatar is not None and old_avatar and old_avatar != user.avatar_url:
        await storage.delete_file(old_avatar)


async def verify_passport(
    session: AsyncSession, storage: StorageService, user: User, passport_photo: UploadFile
) -> None:
    """ЗАГЛУШКА: фото сохраняется в приватное хранилище и паспорт сразу считается
    подтверждённым. В продакшене — очередь на ручную проверку модератором."""
    key = await storage.upload_private(passport_photo, f"passports/{user.id}")
    user.passport_photo_key = key
    user.passport_verified = True
    user.passport_verified_at = utcnow()
    await session.flush()
    await recalculate_trust_score(user.id, session)
    await session.commit()
    logger.info("passport_verified_stub", user_id=str(user.id))


async def link_telegram(session: AsyncSession, user: User, telegram_id: int) -> None:
    """Один Telegram — один аккаунт: у прежнего владельца привязка снимается."""
    previous = await session.scalar(
        select(User).where(User.telegram_id == telegram_id, User.id != user.id)
    )
    if previous is not None:
        previous.telegram_id = None
        await session.flush()
    user.telegram_id = telegram_id
    await session.commit()
    logger.info("telegram_linked", user_id=str(user.id), moved=previous is not None)
