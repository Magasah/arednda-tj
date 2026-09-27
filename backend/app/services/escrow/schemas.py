import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.models.escrow import EscrowStatus
from app.schemas.common import ORMModel


class EscrowRead(ORMModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    amount: Decimal = Field(examples=["450.00"])
    deposit: Decimal = Field(examples=["2000.00"])
    status: EscrowStatus
    provider: str
    provider_tx_id: str | None
    frozen_at: datetime | None
    released_at: datetime | None
    payout_amount: Decimal | None = Field(examples=["450.00"])
    deposit_refund_amount: Decimal | None = Field(examples=["2000.00"])
    deposit_returned_at: datetime | None
