"""Регистрация и вход по номеру телефона: OTP в Redis (HMAC, TTL, rate-limit), выдача JWT.

Примитивы — в app.core.security; эндпоинты /auth/register, /auth/verify-otp,
/auth/login реализуются следующей задачей (см. WORK_LOG).
"""
