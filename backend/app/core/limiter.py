"""Rate limiting (slowapi). Хранилище — из RATE_LIMIT_STORAGE_URI.

Ключ — IP клиента. Исключения — доверенные посредники, у которых все
пользователи приходят с одного IP:
- Telegram-бот с верным X-Bot-Secret — лимит по пользователю Telegram (X-Telegram-User-Id);
- сервер сайта (Next.js BFF) с верным X-Web-Secret — лимит по IP посетителя (X-Client-IP).
"""

import hmac
import ipaddress

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def is_bot_request(request: Request) -> bool:
    secret = settings.bot_api_secret.get_secret_value()
    provided = request.headers.get("x-bot-secret", "")
    return bool(secret) and hmac.compare_digest(provided, secret)


def is_web_request(request: Request) -> bool:
    secret = settings.web_api_secret.get_secret_value()
    provided = request.headers.get("x-web-secret", "")
    return bool(secret) and hmac.compare_digest(provided, secret)


def _valid_ip(value: str) -> bool:
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return False
    return True


def rate_limit_key(request: Request) -> str:
    telegram_id = request.headers.get("x-telegram-user-id", "")
    if telegram_id.isdigit() and is_bot_request(request):
        return f"tg:{telegram_id}"
    client_ip = request.headers.get("x-client-ip", "").strip()
    if client_ip and _valid_ip(client_ip) and is_web_request(request):
        return f"web:{client_ip}"
    return get_remote_address(request)


limiter = Limiter(key_func=rate_limit_key, storage_uri=settings.rate_limit_storage_uri)
