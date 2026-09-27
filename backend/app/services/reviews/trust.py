"""Trust score пользователя: 1.00..5.00, по умолчанию 4.00 (нет отзывов).

base = средняя видимая оценка (без скрытых антифродом и удалённых)
+0.2 паспорт подтверждён | +0.1 сделок ≥ 10 | +0.1 сделок ≥ 25
+0.1 возвратов без спора ≥ 98% | +0.1 аккаунту ≥ 180 дней
−0.5 открытый спор (как арендатор) | −0.3 за каждый решённый спор с ущербом
−1.0 если скрыто антифродом > 30% полученных отзывов
итог = clamp(1.0, 5.0)
"""

import uuid
from datetime import timedelta
from decimal import Decimal

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import CacheService
from app.core.logging import logger
from app.core.timeutils import utcnow
from app.models import User
from app.services.users import stats

NEUTRAL_SCORE = 4.0
TRUST_TTL = 3600


def trust_key(user_id: uuid.UUID) -> str:
    return f"trust:{user_id}"


class TrustBreakdown(BaseModel):
    base_rating: float = Field(description="Средняя видимая оценка (или 4.0, если отзывов нет)")
    reviews_count: int
    verified_bonus: float = Field(description="+0.2 за подтверждённый паспорт")
    deals_bonus: float = Field(description="+0.1 за ≥10 сделок, ещё +0.1 за ≥25")
    reliability_bonus: float = Field(description="+0.1 возвраты ≥98%, +0.1 аккаунт ≥180 дней")
    penalty: float = Field(description="Сумма штрафов (споры, скрытые отзывы) — вычитается")
    final_score: float = Field(examples=[4.7])


async def compute_breakdown(session: AsyncSession, user: User) -> TrustBreakdown:
    """Расчёт без записи в БД — для профиля и для пересчёта."""
    summary = await stats.reviews_summary(session, user.id)
    if summary.total == 0:
        return TrustBreakdown(
            base_rating=NEUTRAL_SCORE,
            reviews_count=0,
            verified_bonus=0,
            deals_bonus=0,
            reliability_bonus=0,
            penalty=0,
            final_score=NEUTRAL_SCORE,
        )

    deals = await stats.total_deals(session, user.id)
    returns = await stats.return_rate(session, user.id)
    disputes = await stats.dispute_penalties(session, user.id)

    verified_bonus = 0.2 if user.passport_verified else 0.0
    deals_bonus = (0.1 if deals >= 10 else 0.0) + (0.1 if deals >= 25 else 0.0)
    reliability_bonus = (0.1 if returns is not None and returns >= 98 else 0.0) + (
        0.1 if utcnow() - user.created_at >= timedelta(days=180) else 0.0
    )

    penalty = 0.5 if disputes.open_disputes else 0.0
    penalty += 0.3 * disputes.resolved_with_damage
    received = summary.total + summary.hidden
    if received and summary.hidden / received > 0.3:
        penalty += 1.0

    base = float(summary.avg or NEUTRAL_SCORE)
    raw = base + verified_bonus + deals_bonus + reliability_bonus - penalty
    return TrustBreakdown(
        base_rating=round(base, 2),
        reviews_count=summary.total,
        verified_bonus=verified_bonus,
        deals_bonus=deals_bonus,
        reliability_bonus=reliability_bonus,
        penalty=round(penalty, 2),
        final_score=round(max(1.0, min(5.0, raw)), 2),
    )


async def recalculate_trust_score(
    user_id: uuid.UUID, db: AsyncSession, cache: CacheService | None = None
) -> float:
    """Пересчитывает и записывает user.trust_score (commit — на вызывающем коде)."""
    user = await db.get(User, user_id)
    if user is None:
        raise ValueError(f"Пользователь {user_id} не найден")

    breakdown = await compute_breakdown(db, user)
    user.trust_score = Decimal(str(breakdown.final_score)).quantize(Decimal("0.01"))
    await db.flush()
    if cache is not None:
        await cache.set(trust_key(user_id), breakdown.model_dump(), TRUST_TTL)
    logger.info("trust_recalculated", user_id=str(user_id), score=breakdown.final_score)
    return breakdown.final_score
