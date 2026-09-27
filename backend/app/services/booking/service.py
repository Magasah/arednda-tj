"""Жизненный цикл брони: pending → payment_frozen → active → return_pending → completed / disputed.

Защита от гонок:
  • создание брони — SELECT … FOR UPDATE на объявлении, параллельные запросы на одну вещь
    выполняются по очереди; последний рубеж — EXCLUDE-ограничение ex_bookings_no_overlap;
  • каждый переход статуса — SELECT … FOR UPDATE на брони + проверка текущего статуса,
    повторный/параллельный запрос получит 409, деньги не обработаются дважды.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.core.storage import StorageService
from app.core.timeutils import local_today, utcnow
from app.models import (
    Booking,
    BookingStatus,
    Dispute,
    EscrowTransaction,
    HandoverRecord,
    Listing,
    ListingStatus,
    User,
)
from app.models.booking import HOLDING_STATUSES
from app.services.booking.schemas import (
    BookingCreate,
    BookingDetail,
    ConfirmReturnRequest,
    HandoverRead,
    ListingBrief,
)
from app.services.escrow.schemas import EscrowRead
from app.services.escrow.service import EscrowError, EscrowService

PHOTOS_MIN, PHOTOS_MAX = 1, 3


def payment_ttl() -> timedelta:
    return timedelta(minutes=settings.booking_payment_ttl_minutes)


def _http(code: int, detail: str) -> HTTPException:
    return HTTPException(code, detail)


# --- Загрузка и представление ----------------------------------------------------


async def _lock_booking(session: AsyncSession, booking_id: uuid.UUID) -> tuple[Booking, Listing]:
    row = (
        await session.execute(
            select(Booking, Listing)
            .join(Listing, Listing.id == Booking.listing_id)
            .where(Booking.id == booking_id)
            .with_for_update(of=Booking)
        )
    ).one_or_none()
    if row is None:
        raise _http(status.HTTP_404_NOT_FOUND, "Бронь не найдена")
    return row[0], row[1]


def _require_participant(booking: Booking, listing: Listing, user: User) -> None:
    if user.id not in (booking.renter_id, listing.owner_id):
        raise _http(status.HTTP_403_FORBIDDEN, "Вы не участник этой сделки")


def _require_renter(booking: Booking, user: User) -> None:
    if booking.renter_id != user.id:
        raise _http(status.HTTP_403_FORBIDDEN, "Действие доступно только арендатору")


def _require_status(booking: Booking, expected: BookingStatus) -> None:
    if booking.status != expected:
        raise _http(
            status.HTTP_409_CONFLICT,
            f"Недопустимо в статусе {booking.status.value}: ожидается {expected.value}",
        )


def _check_photos(files: list[UploadFile]) -> None:
    if not PHOTOS_MIN <= len(files) <= PHOTOS_MAX:
        raise _http(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Нужно от {PHOTOS_MIN} до {PHOTOS_MAX} фото, передано {len(files)}",
        )


async def build_detail(session: AsyncSession, booking: Booking, listing: Listing) -> BookingDetail:
    escrow = await session.scalar(
        select(EscrowTransaction).where(EscrowTransaction.booking_id == booking.id)
    )
    handover = await session.scalar(
        select(HandoverRecord).where(HandoverRecord.booking_id == booking.id)
    )
    return BookingDetail(
        id=booking.id,
        listing=ListingBrief(
            id=listing.id,
            title=listing.title,
            city=listing.city,
            photo=listing.photos[0] if listing.photos else None,
            owner_id=listing.owner_id,
            price_per_day=listing.price_per_day,
        ),
        renter_id=booking.renter_id,
        owner_id=listing.owner_id,
        start_date=booking.start_date,
        end_date=booking.end_date,
        days=(booking.end_date - booking.start_date).days,
        total_price=booking.total_price,
        deposit_amount=booking.deposit_amount,
        status=booking.status,
        payment_expires_at=(
            booking.created_at + payment_ttl() if booking.status == BookingStatus.PENDING else None
        ),
        escrow=EscrowRead.model_validate(escrow) if escrow else None,
        handover=HandoverRead.model_validate(handover) if handover else None,
        created_at=booking.created_at,
    )


async def get_booking(
    session: AsyncSession, booking_id: uuid.UUID, user: User
) -> tuple[Booking, Listing]:
    row = (
        await session.execute(
            select(Booking, Listing)
            .join(Listing, Listing.id == Booking.listing_id)
            .where(Booking.id == booking_id)
        )
    ).one_or_none()
    if row is None:
        raise _http(status.HTTP_404_NOT_FOUND, "Бронь не найдена")
    booking, listing = row
    _require_participant(booking, listing, user)
    return booking, listing


async def list_bookings(
    session: AsyncSession, user: User, role: str, page: int, limit: int
) -> tuple[list[BookingDetail], int]:
    query = select(Booking, Listing).join(Listing, Listing.id == Booking.listing_id)
    query = query.where(
        Booking.renter_id == user.id if role == "renter" else Listing.owner_id == user.id
    )
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.execute(
        query.order_by(Booking.created_at.desc()).limit(limit).offset((page - 1) * limit)
    )
    return [await build_detail(session, b, lst) for b, lst in rows], total


# --- 1. Создание брони -----------------------------------------------------------


async def create_booking(
    session: AsyncSession, renter: User, data: BookingCreate, now: datetime | None = None
) -> tuple[Booking, Listing, User]:
    today = local_today(now)
    if data.start_date <= today:
        raise _http(status.HTTP_422_UNPROCESSABLE_CONTENT, "Бронировать можно начиная с завтра")
    days = (data.end_date - data.start_date).days
    if days > settings.booking_max_days:
        raise _http(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Максимальный срок аренды — {settings.booking_max_days} дней",
        )

    # Блокировка объявления: параллельные брони этой вещи встают в очередь
    listing = await session.scalar(
        select(Listing).where(Listing.id == data.listing_id).with_for_update()
    )
    if listing is None:
        raise _http(status.HTTP_404_NOT_FOUND, "Объявление не найдено")
    if listing.owner_id == renter.id:
        raise _http(status.HTTP_403_FORBIDDEN, "Нельзя бронировать своё объявление")
    if listing.status != ListingStatus.ACTIVE:
        raise _http(status.HTTP_409_CONFLICT, "Объявление недоступно для бронирования")

    overlap = await session.scalar(
        select(
            exists().where(
                Booking.listing_id == listing.id,
                Booking.status.in_(HOLDING_STATUSES),
                func.daterange(Booking.start_date, Booking.end_date, "[)").op("&&")(
                    func.daterange(data.start_date, data.end_date, "[)")
                ),
            )
        )
    )
    if overlap:
        raise _http(status.HTTP_409_CONFLICT, "Эти даты уже заняты")

    booking = Booking(
        listing_id=listing.id,
        renter_id=renter.id,
        start_date=data.start_date,
        end_date=data.end_date,
        total_price=(listing.price_per_day * days).quantize(Decimal("0.01")),
        deposit_amount=listing.deposit_amount,
        status=BookingStatus.PENDING,
    )
    session.add(booking)
    try:
        await session.commit()
    except IntegrityError as exc:
        # Страховка на уровне БД (ex_bookings_no_overlap)
        await session.rollback()
        if "ex_bookings_no_overlap" in str(exc.orig):
            raise _http(status.HTTP_409_CONFLICT, "Эти даты уже заняты") from exc
        raise
    await session.refresh(booking)

    owner = await session.get(User, listing.owner_id)
    assert owner is not None
    logger.info("booking_created", booking_id=str(booking.id), listing_id=str(listing.id))
    return booking, listing, owner


async def cancel_booking(
    session: AsyncSession, booking_id: uuid.UUID, user: User
) -> tuple[Booking, Listing]:
    """Арендатор отменяет неоплаченную бронь — даты сразу освобождаются."""
    booking, listing = await _lock_booking(session, booking_id)
    _require_renter(booking, user)
    _require_status(booking, BookingStatus.PENDING)
    booking.status = BookingStatus.CANCELLED
    await session.commit()
    return booking, listing


# --- 2. Оплата → заморозка --------------------------------------------------------


async def confirm_payment(
    session: AsyncSession,
    booking_id: uuid.UUID,
    user: User,
    provider: str,
    now: datetime | None = None,
) -> tuple[Booking, Listing, EscrowTransaction]:
    booking, listing = await _lock_booking(session, booking_id)
    _require_renter(booking, user)
    _require_status(booking, BookingStatus.PENDING)

    if (now or utcnow()) > booking.created_at + payment_ttl():
        booking.status = BookingStatus.CANCELLED
        await session.commit()
        raise _http(status.HTTP_409_CONFLICT, "Время на оплату истекло, бронь отменена")

    try:
        escrow = await EscrowService(session).freeze(
            booking.id, booking.total_price, booking.deposit_amount, provider
        )
    except IntegrityError as exc:
        await session.rollback()
        raise _http(status.HTTP_409_CONFLICT, "Оплата по этой брони уже проведена") from exc

    booking.status = BookingStatus.PAYMENT_FROZEN
    await session.commit()
    return booking, listing, escrow


# --- 3. Передача вещи ------------------------------------------------------------


async def handover(
    session: AsyncSession,
    storage: StorageService,
    booking_id: uuid.UUID,
    user: User,
    files: list[UploadFile],
) -> tuple[Booking, HandoverRecord]:
    _check_photos(files)
    booking, _ = await _lock_booking(session, booking_id)
    _require_renter(booking, user)
    _require_status(booking, BookingStatus.PAYMENT_FROZEN)

    urls = await storage.upload_many(files, f"handovers/{booking.id}/before")
    record = HandoverRecord(booking_id=booking.id, photos_before=urls, handover_at=utcnow())
    session.add(record)
    booking.status = BookingStatus.ACTIVE
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        for url in urls:
            await storage.delete_file(url)
        raise
    return booking, record


# --- 4. Возврат вещи арендатором -------------------------------------------------


@dataclass
class ReturnResult:
    booking: Booking
    listing: Listing
    overdue_days: int
    penalty: Decimal


async def return_item(
    session: AsyncSession,
    storage: StorageService,
    booking_id: uuid.UUID,
    user: User,
    files: list[UploadFile],
    now: datetime | None = None,
) -> ReturnResult:
    _check_photos(files)
    booking, listing = await _lock_booking(session, booking_id)
    _require_renter(booking, user)
    _require_status(booking, BookingStatus.ACTIVE)

    record = await session.scalar(
        select(HandoverRecord).where(HandoverRecord.booking_id == booking.id).with_for_update()
    )
    if record is None:
        raise _http(status.HTTP_409_CONFLICT, "Нет акта передачи — сначала подтвердите получение")

    returned_on = local_today(now)
    overdue_days = max((returned_on - booking.end_date).days, 0)
    penalty = EscrowService.penalty_for(
        listing.price_per_day, booking.end_date, returned_on, booking.deposit_amount
    )

    urls = await storage.upload_many(files, f"handovers/{booking.id}/after")
    record.photos_after = urls
    record.return_at = now or utcnow()
    booking.status = BookingStatus.RETURN_PENDING
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        for url in urls:
            await storage.delete_file(url)
        raise
    return ReturnResult(booking, listing, overdue_days, penalty)


# --- 5. Подтверждение возврата владельцем ----------------------------------------


@dataclass
class ConfirmReturnResult:
    booking: Booking
    listing: Listing
    escrow: EscrowTransaction
    penalty: Decimal
    dispute: Dispute | None


async def confirm_return(
    session: AsyncSession,
    booking_id: uuid.UUID,
    owner: User | None,
    data: ConfirmReturnRequest,
) -> ConfirmReturnResult:
    """owner=None — автоподтверждение по таймауту (задача Celery)."""
    booking, listing = await _lock_booking(session, booking_id)
    if owner is not None and listing.owner_id != owner.id:
        raise _http(status.HTTP_403_FORBIDDEN, "Подтвердить возврат может только владелец")
    _require_status(booking, BookingStatus.RETURN_PENDING)

    escrow_row = await session.scalar(
        select(EscrowTransaction).where(EscrowTransaction.booking_id == booking.id)
    )
    if escrow_row is None:
        raise _http(status.HTTP_409_CONFLICT, "По брони нет замороженных средств")

    escrow_service = EscrowService(session)
    penalty = await escrow_service.calculate_penalty(booking.id)
    dispute: Dispute | None = None
    try:
        if data.condition == "good":
            if penalty > 0:
                escrow = await escrow_service.partial_release(escrow_row.id, penalty)
            else:
                escrow = await escrow_service.release(escrow_row.id, release_deposit=True)
            booking.status = BookingStatus.COMPLETED
            booking.completed_at = utcnow()
        else:
            # Деньги остаются замороженными до решения спора
            escrow = escrow_row
            booking.status = BookingStatus.DISPUTED
            dispute = Dispute(
                booking_id=booking.id,
                opened_by=listing.owner_id,
                reason=(data.damage_description or "").strip(),
            )
            session.add(dispute)
    except EscrowError as exc:
        await session.rollback()
        raise _http(status.HTTP_409_CONFLICT, str(exc)) from exc

    await session.commit()
    logger.info(
        "return_confirmed",
        booking_id=str(booking.id),
        condition=data.condition,
        auto=owner is None,
        escrow_status=escrow.status.value,
    )
    return ConfirmReturnResult(booking, listing, escrow, penalty, dispute)


async def get_dispute(session: AsyncSession, booking_id: uuid.UUID, user: User) -> Dispute:
    await get_booking(session, booking_id, user)
    dispute = await session.scalar(select(Dispute).where(Dispute.booking_id == booking_id))
    if dispute is None:
        raise _http(status.HTTP_404_NOT_FOUND, "По этой брони нет спора")
    return dispute


# --- Периодические операции (вызываются задачами Celery) -------------------------


async def cancel_expired_pending(
    session: AsyncSession, now: datetime | None = None
) -> list[tuple[Booking, Listing]]:
    """Отменяет pending-брони, не оплаченные за booking_payment_ttl_minutes."""
    deadline = (now or utcnow()) - payment_ttl()
    rows = (
        await session.execute(
            select(Booking, Listing)
            .join(Listing, Listing.id == Booking.listing_id)
            .where(Booking.status == BookingStatus.PENDING, Booking.created_at < deadline)
            # SKIP LOCKED: не ждём брони, которые прямо сейчас оплачиваются
            .with_for_update(of=Booking, skip_locked=True)
        )
    ).all()
    for booking, _ in rows:
        booking.status = BookingStatus.CANCELLED
    await session.commit()
    return [(b, lst) for b, lst in rows]


async def overdue_return_pending_ids(
    session: AsyncSession, now: datetime | None = None
) -> list[uuid.UUID]:
    """Возвраты, которые владелец не подтвердил за return_auto_confirm_hours."""
    deadline = (now or utcnow()) - timedelta(hours=settings.return_auto_confirm_hours)
    rows = await session.scalars(
        select(Booking.id)
        .join(HandoverRecord, HandoverRecord.booking_id == Booking.id)
        .where(Booking.status == BookingStatus.RETURN_PENDING, HandoverRecord.return_at < deadline)
    )
    return list(rows)


async def returns_due_tomorrow(
    session: AsyncSession, now: datetime | None = None
) -> list[tuple[Booking, Listing]]:
    tomorrow = local_today(now) + timedelta(days=1)
    rows = await session.execute(
        select(Booking, Listing)
        .join(Listing, Listing.id == Booking.listing_id)
        .where(Booking.status == BookingStatus.ACTIVE, Booking.end_date == tomorrow)
    )
    return [(b, lst) for b, lst in rows]
