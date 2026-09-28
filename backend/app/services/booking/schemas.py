import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.booking import BookingStatus
from app.models.dispute import DisputeStatus
from app.schemas.common import ORMModel
from app.services.escrow.schemas import EscrowRead


class BookingCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "listing_id": "01a0dd57-d538-753e-8323-311ca4ed9c8c",
                    "start_date": "2026-10-01",
                    "end_date": "2026-10-04",
                }
            ]
        }
    )

    listing_id: uuid.UUID
    start_date: date = Field(description="День получения вещи (не раньше завтра)")
    end_date: date = Field(
        description="День возврата: не оплачивается, вещь свободна для следующей брони"
    )

    @model_validator(mode="after")
    def _dates(self) -> BookingCreate:
        if self.end_date <= self.start_date:
            raise ValueError("end_date должна быть позже start_date")
        return self


class ListingBrief(BaseModel):
    id: uuid.UUID
    title: str
    city: str
    photo: str | None = Field(description="Первое фото объявления")
    owner_id: uuid.UUID
    price_per_day: Decimal = Field(examples=["150.00"])


class Participant(BaseModel):
    id: uuid.UUID
    name: str | None
    avatar_url: str | None


class HandoverRead(ORMModel):
    id: uuid.UUID
    photos_before: list[str]
    photos_after: list[str] | None
    handover_at: datetime | None
    return_at: datetime | None


class BookingDetail(BaseModel):
    id: uuid.UUID
    listing: ListingBrief
    renter_id: uuid.UUID
    owner_id: uuid.UUID
    renter: Participant
    owner: Participant
    start_date: date
    end_date: date
    days: int = Field(examples=[3])
    total_price: Decimal = Field(examples=["450.00"])
    deposit_amount: Decimal = Field(examples=["2000.00"])
    status: BookingStatus
    payment_expires_at: datetime | None = Field(
        description="Для pending: до какого момента ждём оплату"
    )
    escrow: EscrowRead | None
    handover: HandoverRead | None
    created_at: datetime
    reviewed_by_me: bool | None = Field(
        default=None,
        description="Оставил ли текущий пользователь отзыв по сделке (null — не запрашивалось)",
    )


class BookingCreatedResponse(BaseModel):
    booking: BookingDetail
    payment_url: str = Field(description="Страница оплаты (заглушка до интеграции Alif Pay)")
    expires_at: datetime = Field(description="Бронь отменится, если не оплатить до этого времени")


class ConfirmPaymentRequest(BaseModel):
    payment_method: Literal["alif", "humo", "cash"]


class ConfirmPaymentResponse(BaseModel):
    booking_id: uuid.UUID
    escrow_id: uuid.UUID
    status: BookingStatus


class HandoverResponse(BaseModel):
    handover_id: uuid.UUID
    photos_before: list[str]
    status: BookingStatus


class ReturnResponse(BaseModel):
    status: BookingStatus
    awaiting_owner_confirmation: bool
    overdue_days: int = 0
    penalty_amount: Decimal = Field(
        default=Decimal("0.00"),
        description="Штраф за просрочку: удержится из депозита при подтверждении возврата",
    )
    message: str


class ConfirmReturnRequest(BaseModel):
    condition: Literal["good", "damaged"]
    damage_description: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _damage(self) -> ConfirmReturnRequest:
        if self.condition == "damaged" and not (self.damage_description or "").strip():
            raise ValueError("Опишите повреждение (damage_description)")
        return self


class ConfirmReturnResponse(BaseModel):
    status: BookingStatus
    payout_amount: Decimal | None = Field(description="Сколько получит владелец")
    deposit_returned: bool
    deposit_refund_amount: Decimal | None = None
    penalty_amount: Decimal = Decimal("0.00")


class DisputeRead(ORMModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    opened_by: uuid.UUID
    reason: str
    status: DisputeStatus
    resolution: str | None
    damage_amount: Decimal | None
    created_at: datetime
    resolved_at: datetime | None
