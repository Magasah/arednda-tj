import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, File, Query, UploadFile, status

from app.core.cache import CacheDep, listing_key
from app.core.config import settings
from app.core.database import SessionDep
from app.core.security import CurrentUser
from app.core.storage import StorageDep
from app.models import User
from app.services.booking import service
from app.services.booking.schemas import (
    BookingCreate,
    BookingCreatedResponse,
    BookingDetail,
    ConfirmPaymentRequest,
    ConfirmPaymentResponse,
    ConfirmReturnRequest,
    ConfirmReturnResponse,
    DisputeRead,
    HandoverResponse,
    ReturnResponse,
)
from app.services.notifications import service as notifications
from app.services.notifications.service import notifier
from app.tasks.dispatch import enqueue

router = APIRouter(prefix="/bookings", tags=["Booking"])

PhotoFiles = Annotated[
    list[UploadFile],
    File(
        description="1–3 фото (JPEG / PNG / WebP, до 10 МБ)",
        json_schema_extra={"items": {"type": "string", "format": "binary"}},
    ),
]


def _notify(tasks: BackgroundTasks, user: User, message: str) -> None:
    # Отправка после ответа клиенту — медленный Telegram не задерживает API
    tasks.add_task(notifier.deliver, user.id, user.telegram_id, message)


@router.post(
    "",
    response_model=BookingCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Забронировать вещь",
    description=(
        "Период [start_date, end_date): end_date — день возврата, он не оплачивается. "
        "start_date не раньше завтра, не больше 30 дней, своё объявление нельзя. "
        "Бронь ждёт оплату 15 минут, затем отменяется автоматически."
    ),
    response_description="Бронь, ссылка на оплату и срок оплаты",
)
async def create_booking(
    data: BookingCreate,
    user: CurrentUser,
    session: SessionDep,
    cache: CacheDep,
    tasks: BackgroundTasks,
) -> BookingCreatedResponse:
    booking, listing, owner = await service.create_booking(session, user, data)
    await cache.delete(listing_key(listing.id))
    # Точная отмена ровно через 15 минут; периодическая задача — страховка
    enqueue(
        "app.tasks.booking_tasks.cancel_booking_if_unpaid",
        booking.id,
        countdown=settings.booking_payment_ttl_minutes * 60 + 5,
    )
    _notify(
        tasks,
        owner,
        notifications.render(
            notifications.BOOKING_RECEIVED,
            listing_title=listing.title,
            start_date=booking.start_date.strftime("%d.%m.%Y"),
            end_date=booking.end_date.strftime("%d.%m.%Y"),
            total_price=booking.total_price,
        ),
    )
    detail = await service.build_detail(session, booking, listing, user)
    return BookingCreatedResponse(
        booking=detail,
        payment_url=f"{settings.payment_page_url.rstrip('/')}/{booking.id}",
        expires_at=booking.created_at + service.payment_ttl(),
    )


@router.get(
    "",
    response_model=list[BookingDetail],
    summary="Мои брони",
    description="role=renter — я арендую, role=owner — бронируют мои вещи.",
    response_description="Брони с деталями объявления",
)
async def list_bookings(
    user: CurrentUser,
    session: SessionDep,
    role: Annotated[Literal["renter", "owner"], Query()] = "renter",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[BookingDetail]:
    items, _ = await service.list_bookings(session, user, role, page, limit)
    return items


@router.get(
    "/{booking_id}",
    response_model=BookingDetail,
    summary="Детали брони",
    description="Только для участников сделки (арендатор и владелец).",
    response_description="Бронь, эскроу и фото-акт",
)
async def get_booking(
    booking_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> BookingDetail:
    booking, listing = await service.get_booking(session, booking_id, user)
    return await service.build_detail(session, booking, listing, user)


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingDetail,
    summary="Отменить бронь",
    description="Арендатор отменяет бронь до оплаты (статус pending). Даты освобождаются.",
    response_description="Отменённая бронь",
)
async def cancel_booking(
    booking_id: uuid.UUID, user: CurrentUser, session: SessionDep, cache: CacheDep
) -> BookingDetail:
    booking, listing = await service.cancel_booking(session, booking_id, user)
    await cache.delete(listing_key(listing.id))
    return await service.build_detail(session, booking, listing, user)


@router.post(
    "/{booking_id}/confirm-payment",
    response_model=ConfirmPaymentResponse,
    summary="Оплатить (имитация)",
    description=(
        "Имитация оплаты до интеграции Alif Pay: создаётся эскроу со статусом frozen "
        "(аренда + депозит), бронь → payment_frozen, владелец получает уведомление."
    ),
    response_description="Эскроу создан, средства заморожены",
)
async def confirm_payment(
    booking_id: uuid.UUID,
    data: ConfirmPaymentRequest,
    user: CurrentUser,
    session: SessionDep,
    tasks: BackgroundTasks,
) -> ConfirmPaymentResponse:
    booking, listing, escrow = await service.confirm_payment(
        session, booking_id, user, data.payment_method
    )
    owner = await session.get(User, listing.owner_id)
    if owner is not None:
        _notify(tasks, owner, notifications.PAYMENT_FROZEN)
    return ConfirmPaymentResponse(booking_id=booking.id, escrow_id=escrow.id, status=booking.status)


@router.post(
    "/{booking_id}/handover",
    response_model=HandoverResponse,
    summary="Получить вещь (фото-акт «до»)",
    description="Арендатор фотографирует вещь при получении. Бронь → active.",
    response_description="Акт передачи",
)
async def handover(
    booking_id: uuid.UUID,
    photos: PhotoFiles,
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
) -> HandoverResponse:
    booking, record = await service.handover(session, storage, booking_id, user, photos)
    return HandoverResponse(
        handover_id=record.id, photos_before=record.photos_before, status=booking.status
    )


@router.post(
    "/{booking_id}/return",
    response_model=ReturnResponse,
    summary="Вернуть вещь (фото-акт «после»)",
    description=(
        "Арендатор фотографирует вещь при возврате. Бронь → return_pending, владелец "
        "должен подтвердить получение (иначе автоподтверждение через 48 ч). "
        "При просрочке считается штраф: цена/сутки × 2 × дни, не больше депозита."
    ),
    response_description="Ожидается подтверждение владельца",
)
async def return_item(
    booking_id: uuid.UUID,
    photos: PhotoFiles,
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    tasks: BackgroundTasks,
) -> ReturnResponse:
    result = await service.return_item(session, storage, booking_id, user, photos)
    owner = await session.get(User, result.listing.owner_id)
    if owner is not None:
        _notify(
            tasks,
            owner,
            notifications.render(notifications.RETURN_PENDING, listing_title=result.listing.title),
        )

    message = "Ожидаем подтверждения владельца."
    if result.overdue_days:
        message = (
            f"Просрочка {result.overdue_days} дн.: штраф {result.penalty} сом "
            "будет удержан из депозита. " + message
        )
    return ReturnResponse(
        status=result.booking.status,
        awaiting_owner_confirmation=True,
        overdue_days=result.overdue_days,
        penalty_amount=result.penalty,
        message=message,
    )


@router.post(
    "/{booking_id}/confirm-return",
    response_model=ConfirmReturnResponse,
    summary="Подтвердить возврат (владелец)",
    description=(
        "good — эскроу закрывается: владелец получает оплату (+ штраф за просрочку), "
        "арендатор — депозит. damaged — бронь → disputed, средства остаются "
        "замороженными, открывается спор."
    ),
    response_description="Итог расчёта",
)
async def confirm_return(
    booking_id: uuid.UUID,
    data: ConfirmReturnRequest,
    user: CurrentUser,
    session: SessionDep,
    cache: CacheDep,
    tasks: BackgroundTasks,
) -> ConfirmReturnResponse:
    result = await service.confirm_return(session, booking_id, user, data)
    await cache.delete(listing_key(result.listing.id))

    renter = await session.get(User, result.booking.renter_id)
    participants = [p for p in (user, renter) if p is not None]
    if result.dispute is not None:
        text = notifications.render(
            notifications.DISPUTE_OPENED, listing_title=result.listing.title
        )
        for person in participants:
            _notify(tasks, person, text)
    else:
        # Напоминание об отзыве через 2 часа — только тем, кто ещё не написал
        enqueue(
            "app.tasks.review_tasks.send_review_reminder",
            result.booking.id,
            countdown=settings.review_reminder_delay_seconds,
        )

    escrow = result.escrow
    return ConfirmReturnResponse(
        status=result.booking.status,
        payout_amount=escrow.payout_amount,
        deposit_returned=escrow.deposit_returned_at is not None,
        deposit_refund_amount=escrow.deposit_refund_amount,
        penalty_amount=result.penalty if data.condition == "good" else 0,
    )


@router.get(
    "/{booking_id}/dispute",
    response_model=DisputeRead,
    summary="Спор по брони",
    description="Только для участников сделки. 404 — спора нет.",
    response_description="Детали спора",
)
async def get_dispute(booking_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> DisputeRead:
    return DisputeRead.model_validate(await service.get_dispute(session, booking_id, user))
