"""Антифрод отзывов: эвристики → fraud_score 0..1 (0 — честный, 1 — накрутка).

Это правила (baseline). Модель ML (ml/fraud_detector.py) будет обучаться на
размеченных этими правилами и модерацией отзывах и заменит веса.
"""

from dataclasses import dataclass, field
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.core.timeutils import utcnow
from app.models import Booking, Review, User

HIDE_THRESHOLD = 0.7

MUTUAL_WINDOW = timedelta(minutes=10)
NEW_ACCOUNT_AGE = timedelta(days=7)
TOO_FAST = timedelta(minutes=1)
PATTERN_PERIOD = timedelta(days=30)
PATTERN_REGISTRATION_WINDOW = timedelta(days=1)
PATTERN_MIN_REVIEWS = 5

WEIGHTS = {
    "mutual_reviews": 0.3,
    "new_account_first_review": 0.25,
    "too_fast": 0.2,
    "rating_pattern": 0.35,
    "short_five_star": 0.1,
}


@dataclass
class FraudResult:
    score: float
    rules: list[str] = field(default_factory=list)
    counterpart: Review | None = None


class FraudDetector:
    async def evaluate(self, review: Review, db: AsyncSession) -> FraudResult:
        created = review.created_at or utcnow()
        rules: list[str] = []

        # 1. Взаимные отзывы в течение 10 минут
        counterpart = await db.scalar(
            select(Review).where(
                Review.from_user_id == review.to_user_id,
                Review.to_user_id == review.from_user_id,
                Review.is_deleted.is_(False),
                Review.id != review.id,
                Review.created_at.between(created - MUTUAL_WINDOW, created + MUTUAL_WINDOW),
            )
        )
        if counterpart is not None:
            rules.append("mutual_reviews")

        author = await db.get(User, review.from_user_id)

        # 2. Новый аккаунт и это его первый отзыв
        if author is not None and created - author.created_at < NEW_ACCOUNT_AGE:
            previous = await db.scalar(
                select(func.count()).where(
                    Review.from_user_id == author.id,
                    Review.id != review.id,
                    Review.created_at < created,
                )
            )
            if not previous:
                rules.append("new_account_first_review")

        # 3. Отзыв меньше чем через минуту после завершения сделки
        completed_at = await db.scalar(
            select(Booking.completed_at).where(Booking.id == review.booking_id)
        )
        if completed_at is not None and created - completed_at < TOO_FAST:
            rules.append("too_fast")

        # 4. Пятёрки от аккаунтов, зарегистрированных в один день (±1 день)
        if review.rating == 5 and author is not None:
            clustered = await db.scalar(
                select(func.count())
                .select_from(Review)
                .join(User, User.id == Review.from_user_id)
                .where(
                    Review.to_user_id == review.to_user_id,
                    Review.rating == 5,
                    Review.is_deleted.is_(False),
                    Review.created_at >= created - PATTERN_PERIOD,
                    User.created_at.between(
                        author.created_at - PATTERN_REGISTRATION_WINDOW,
                        author.created_at + PATTERN_REGISTRATION_WINDOW,
                    ),
                )
            )
            if (clustered or 0) >= PATTERN_MIN_REVIEWS:
                rules.append("rating_pattern")

        # 5. Пятёрка без текста или короче 3 слов
        if review.rating == 5 and len((review.text or "").split()) < 3:
            rules.append("short_five_star")

        score = round(min(1.0, sum(WEIGHTS[r] for r in rules)), 2)
        return FraudResult(score=score, rules=rules, counterpart=counterpart)

    def apply(self, review: Review, result: FraudResult) -> None:
        review.fraud_score = result.score
        review.is_hidden = result.score >= HIDE_THRESHOLD
        if review.is_hidden:
            logger.warning(f"Подозрительный отзыв {review.id}: {result.score}", rules=result.rules)

    async def check(self, review: Review, db: AsyncSession) -> float:
        """Оценивает отзыв и записывает fraud_score / is_hidden.

        Правило взаимных отзывов симметрично: при совпадении пересчитывается и
        встречный отзыв (иначе первый из пары никогда не получил бы +0.3).
        """
        result = await self.evaluate(review, db)
        self.apply(review, result)
        if result.counterpart is not None:
            self.apply(result.counterpart, await self.evaluate(result.counterpart, db))
        await db.flush()
        return result.score
