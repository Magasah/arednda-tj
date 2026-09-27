"""Эскроу: заморозка и расчёт средств по сделке.

⚠️ Финансовая логика — изменения только после ревью команды (AI_RULES).
Сейчас провайдер замоканный: реального списания нет, provider_tx_id = MOCK_*.
Все методы работают внутри транзакции вызывающего кода и не делают commit —
смена статуса брони и эскроу фиксируется атомарно одним commit.
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.core.timeutils import local_today, utcnow
from app.models import Booking, EscrowStatus, EscrowTransaction, HandoverRecord, Listing

ZERO = Decimal("0.00")


class EscrowError(Exception):
    """Недопустимая операция с эскроу (неверный статус, повторная обработка)."""


class EscrowService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _locked(self, escrow_id: uuid.UUID) -> EscrowTransaction:
        escrow = await self.session.scalar(
            select(EscrowTransaction).where(EscrowTransaction.id == escrow_id).with_for_update()
        )
        if escrow is None:
            raise EscrowError("Эскроу-транзакция не найдена")
        return escrow

    @staticmethod
    def _require_frozen(escrow: EscrowTransaction) -> None:
        if escrow.status != EscrowStatus.FROZEN or escrow.released_at is not None:
            raise EscrowError(f"Средства уже обработаны (статус {escrow.status})")

    async def freeze(
        self, booking_id: uuid.UUID, amount: Decimal, deposit: Decimal, provider: str
    ) -> EscrowTransaction:
        # Здесь будет вызов Alif Pay / Humo: холдирование amount + deposit на карте
        escrow = EscrowTransaction(
            booking_id=booking_id,
            amount=amount,
            deposit=deposit,
            status=EscrowStatus.FROZEN,
            provider=provider,
            provider_tx_id=f"MOCK_{uuid.uuid4().hex[:8].upper()}",
            frozen_at=utcnow(),
        )
        self.session.add(escrow)
        # unique(booking_id) не даст заморозить деньги по одной брони дважды
        await self.session.flush()
        logger.info(
            "escrow_frozen",
            booking_id=str(booking_id),
            escrow_id=str(escrow.id),
            amount=str(amount),
            deposit=str(deposit),
            provider=provider,
        )
        return escrow

    async def release(
        self, escrow_id: uuid.UUID, release_deposit: bool = True
    ) -> EscrowTransaction:
        """Владелец получает оплату аренды. Депозит — арендатору (или остаётся при споре)."""
        escrow = await self._locked(escrow_id)
        self._require_frozen(escrow)

        now = utcnow()
        escrow.payout_amount = escrow.amount
        escrow.released_at = now
        if release_deposit:
            escrow.status = EscrowStatus.RELEASED
            escrow.deposit_refund_amount = escrow.deposit
            escrow.deposit_returned_at = now
        # Иначе статус остаётся frozen: депозит удерживается до решения спора

        await self.session.flush()
        logger.info(
            "escrow_released",
            escrow_id=str(escrow.id),
            payout=str(escrow.payout_amount),
            deposit_released=release_deposit,
        )
        return escrow

    async def partial_release(
        self, escrow_id: uuid.UUID, damage_amount: Decimal
    ) -> EscrowTransaction:
        """Часть депозита удерживается в пользу владельца (ущерб или штраф за просрочку)."""
        if damage_amount < 0:
            raise EscrowError("Сумма удержания не может быть отрицательной")
        escrow = await self._locked(escrow_id)
        self._require_frozen(escrow)

        # Удержать больше депозита нельзя — платформа не может списать то, чего не морозила
        withheld = min(damage_amount, escrow.deposit)
        now = utcnow()
        escrow.status = EscrowStatus.PARTIAL_RETURNED
        escrow.payout_amount = escrow.amount + withheld
        escrow.deposit_refund_amount = escrow.deposit - withheld
        escrow.released_at = now
        escrow.deposit_returned_at = now

        await self.session.flush()
        logger.info(
            "escrow_partial_release",
            escrow_id=str(escrow.id),
            withheld=str(withheld),
            payout=str(escrow.payout_amount),
            refund=str(escrow.deposit_refund_amount),
        )
        return escrow

    @staticmethod
    def penalty_for(
        price_per_day: Decimal, end_date: date, returned_on: date, deposit: Decimal
    ) -> Decimal:
        overdue_days = (returned_on - end_date).days
        if overdue_days <= 0:
            return ZERO
        penalty = price_per_day * settings.late_penalty_multiplier * overdue_days
        return min(penalty, deposit).quantize(ZERO)

    async def calculate_penalty(
        self, booking_id: uuid.UUID, returned_on: date | None = None
    ) -> Decimal:
        """Штраф за просрочку = цена/сутки × 2 × дни просрочки, не больше депозита."""
        row = (
            await self.session.execute(
                select(Booking, Listing.price_per_day, HandoverRecord.return_at)
                .join(Listing, Listing.id == Booking.listing_id)
                .outerjoin(HandoverRecord, HandoverRecord.booking_id == Booking.id)
                .where(Booking.id == booking_id)
            )
        ).one_or_none()
        if row is None:
            raise EscrowError("Бронь не найдена")

        booking, price_per_day, return_at = row
        if returned_on is None:
            returned_on = local_today(return_at) if return_at else local_today()
        return self.penalty_for(
            price_per_day, booking.end_date, returned_on, booking.deposit_amount
        )
