"""Rate limiting (slowapi). Хранилище — из RATE_LIMIT_STORAGE_URI.

Ключ — IP клиента. Исключение — запросы Telegram-бота с верным X-Bot-Secret:
все пользователи бота приходят с одного IP, поэтому лимит считается по
пользователю Telegram (X-Telegram-User-Id).
"""

import hmac

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def is_bot_request(request: Request) -> bool:
    secret = settings.bot_api_secret.get_secret_value()
    provided = request.headers.get("x-bot-secret", "")
    return bool(secret) and hmac.compare_digest(provided, secret)


def rate_limit_key(request: Request) -> str:
    telegram_id = request.headers.get("x-telegram-user-id", "")
    if telegram_id.isdigit() and is_bot_request(request):
        return f"tg:{telegram_id}"
    return get_remote_address(request)


limiter = Limiter(key_func=rate_limit_key, storage_uri=settings.rate_limit_storage_uri)
