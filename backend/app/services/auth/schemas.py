import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import AliasChoices, BaseModel, Field

from app.schemas.common import ORMModel, TjPhone


class SendOTPRequest(BaseModel):
    phone: TjPhone = Field(examples=["+992900123456"])


class SendOTPResponse(BaseModel):
    message: str = "Код отправлен"
    expires_in: int = Field(description="Срок жизни кода, секунд")


class VerifyOTPRequest(BaseModel):
    phone: TjPhone = Field(examples=["+992900123456"])
    code: str = Field(pattern=r"^\d{6}$", examples=["123456"])


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    # Необязательно: если передан — отзывается и refresh-токен
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"  # noqa: S105 — тип токена по RFC 6750, не секрет
    is_new_user: bool | None = None


class MessageResponse(BaseModel):
    message: str


class UserResponse(ORMModel):
    id: uuid.UUID
    phone: str
    name: str | None
    avatar_url: str | None
    trust_score: Decimal = Field(examples=["4.80"], description="Доверие 1.00..5.00")
    is_verified: bool = Field(
        validation_alias=AliasChoices("is_verified", "passport_verified"),
        description="Паспорт подтверждён",
    )
    created_at: datetime
