"""ASGI-middleware: X-Request-ID для трассировки запросов через логи и сервисы."""

import uuid

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = b"x-request-id"


class RequestIDMiddleware:
    """Чистый ASGI (без BaseHTTPMiddleware) — не ломает стриминг и быстрее."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = dict(scope["headers"]).get(REQUEST_ID_HEADER, b"").decode("latin-1")
        request_id = incoming[:64] or uuid.uuid7().hex

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).append(
                    (REQUEST_ID_HEADER, request_id.encode("latin-1"))
                )
            await send(message)

        await self.app(scope, receive, send_with_id)
