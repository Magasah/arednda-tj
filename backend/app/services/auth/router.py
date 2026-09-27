import uuid

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.database import SessionDep
from app.core.limiter import limiter
from app.core.redis import RedisDep
from app.core.security import (
    CurrentTokenPayload,
    CurrentUser,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_active_token,
    revoke,
)
from app.services.auth import users
from app.services.auth.otp import OTPService
from app.services.auth.schemas import (
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    SendOTPRequest,
    SendOTPResponse,
    TokenResponse,
    UserResponse,
    VerifyOTPRequest,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/send-otp", response_model=SendOTPResponse, summary="Отправить SMS-код")
@limiter.limit("1/minute")
async def send_otp(request: Request, body: SendOTPRequest, redis: RedisDep) -> SendOTPResponse:
    otp = OTPService(redis)
    code = await otp.issue(body.phone)
    await otp.send(body.phone, code)
    return SendOTPResponse(expires_in=settings.otp_ttl_seconds)


@router.post(
    "/verify-otp",
    response_model=TokenResponse,
    summary="Проверить код → токены (новый номер регистрируется автоматически)",
)
async def verify_otp(body: VerifyOTPRequest, redis: RedisDep, session: SessionDep) -> TokenResponse:
    if not await OTPService(redis).verify(body.phone, body.code):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Неверный или просроченный код",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user, created = await users.get_or_create_verified(session, body.phone)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт заблокирован")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        is_new_user=created,
    )


@router.post("/refresh", response_model=TokenResponse, summary="Новый access по refresh-токену")
async def refresh(body: RefreshRequest, redis: RedisDep) -> TokenResponse:
    payload = await decode_active_token(redis, body.refresh_token, TokenType.REFRESH)
    return TokenResponse(access_token=create_access_token(uuid.UUID(payload["sub"])))


@router.get("/me", response_model=UserResponse, summary="Текущий пользователь")
async def me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)


@router.post("/logout", response_model=MessageResponse, summary="Выход: отзыв токенов")
async def logout(
    payload: CurrentTokenPayload,
    redis: RedisDep,
    body: LogoutRequest | None = None,
) -> MessageResponse:
    await revoke(redis, payload)
    if body and body.refresh_token:
        refresh_payload = await decode_active_token(redis, body.refresh_token, TokenType.REFRESH)
        if refresh_payload["sub"] == payload["sub"]:
            await revoke(redis, refresh_payload)
    return MessageResponse(message="Выход выполнен")
