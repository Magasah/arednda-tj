"""Тестовый стенд бота: Telegram Bot API и backend подменены, Redis — fakeredis."""

import json
import os
from collections.abc import AsyncIterator, Callable, Iterator
from dataclasses import dataclass, field
from datetime import datetime
from itertools import count
from typing import Any

os.environ.setdefault("BOT_TOKEN", "123456:TEST")
os.environ.setdefault("BOT_API_SECRET", "test-bot-secret")

import httpx
import pytest
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.client.session.base import BaseSession
from aiogram.enums import ParseMode
from aiogram.methods import AnswerCallbackQuery, GetFile, SetMyCommands, TelegramMethod
from aiogram.types import CallbackQuery, Chat, File, Message, PhotoSize, Update, User
from fakeredis.aioredis import FakeRedis

from api.client import KiroyaAPI
from config import get_settings
from main import build_dispatcher

TG_USER = User(id=4242, is_bot=False, first_name="Сино")
CHAT = Chat(id=4242, type="private")
_ids = count(1)


class MockedSession(BaseSession):
    """Вместо сети — запись вызовов Bot API и правдоподобные ответы."""

    def __init__(self) -> None:
        super().__init__()
        self.requests: list[TelegramMethod[Any]] = []

    async def make_request(
        self,
        bot: Bot,
        method: TelegramMethod[Any],
        timeout: int | None = None,  # noqa: ASYNC109 — сигнатура BaseSession из aiogram
    ) -> Any:
        self.requests.append(method)
        if isinstance(method, AnswerCallbackQuery | SetMyCommands):
            return True
        if isinstance(method, GetFile):
            return File(file_id=method.file_id, file_unique_id="u", file_path="photos/p.jpg")
        return Message(message_id=next(_ids), date=datetime.now(), chat=CHAT, text="ok")

    async def stream_content(
        self,
        url: str,
        headers: Any = None,
        timeout: int = 30,  # noqa: ASYNC109 — сигнатура BaseSession из aiogram
        chunk_size: int = 65536,
        raise_for_status: bool = True,
    ) -> Any:
        yield b"\xff\xd8\xff" + b"\x00" * 64

    async def close(self) -> None:
        return None

    def sent(self) -> list[Any]:
        """Отправленные пользователю сообщения/фото (без служебных вызовов)."""
        return [r for r in self.requests if type(r).__name__ in {"SendMessage", "SendPhoto"}]

    def texts(self) -> list[str]:
        return [getattr(r, "text", None) or getattr(r, "caption", "") or "" for r in self.sent()]


@dataclass
class FakeBackend:
    """Маршруты backend: (METHOD, path) → функция(request) → (status, json)."""

    routes: dict[tuple[str, str], Callable[[httpx.Request], tuple[int, Any]]] = field(
        default_factory=dict
    )
    calls: list[httpx.Request] = field(default_factory=list)

    def on(self, method: str, path: str, status: int = 200, body: Any = None) -> None:
        self.routes[(method, path)] = lambda _req: (status, body)

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        path = request.url.path.removeprefix("/api/v1")
        route = self.routes.get((request.method, path))
        if route is None:
            return httpx.Response(404, json={"detail": f"no route {request.method} {path}"})
        status, body = route(request)
        return httpx.Response(status, json=body)

    def last(self, method: str, path: str) -> httpx.Request:
        return next(
            r
            for r in reversed(self.calls)
            if r.method == method and r.url.path.removeprefix("/api/v1") == path
        )


@dataclass
class Harness:
    bot: Bot
    dp: Dispatcher
    session: MockedSession
    backend: FakeBackend
    redis: FakeRedis

    async def text(self, text: str, **extra: Any) -> None:
        message = Message(
            message_id=next(_ids),
            date=datetime.now(),
            chat=CHAT,
            from_user=TG_USER,
            text=text,
            **extra,
        )
        await self.dp.feed_update(self.bot, Update(update_id=next(_ids), message=message))

    async def message(self, **fields: Any) -> None:
        message = Message(
            message_id=next(_ids), date=datetime.now(), chat=CHAT, from_user=TG_USER, **fields
        )
        await self.dp.feed_update(self.bot, Update(update_id=next(_ids), message=message))

    async def click(self, data: str) -> None:
        origin = Message(message_id=next(_ids), date=datetime.now(), chat=CHAT, text="menu")
        callback = CallbackQuery(
            id=str(next(_ids)), from_user=TG_USER, chat_instance="c", data=data, message=origin
        )
        await self.dp.feed_update(self.bot, Update(update_id=next(_ids), callback_query=callback))

    async def login(self) -> None:
        await self.redis.set(f"bot:token:{TG_USER.id}", "access-1")
        await self.redis.set(f"bot:refresh:{TG_USER.id}", "refresh-1")
        await self.redis.set(f"bot:phone:{TG_USER.id}", "+992901234567")

    def keyboard_texts(self, index: int = -1) -> list[str]:
        markup = self.session.sent()[index].reply_markup
        rows = getattr(markup, "inline_keyboard", None) or getattr(markup, "keyboard", None) or []
        return [button.text for row in rows for button in row]


@pytest.fixture(scope="session")
async def _stand() -> AsyncIterator[Harness]:
    """Один Dispatcher на сессию: роутеры aiogram — модульные и прикрепляются один раз."""
    get_settings.cache_clear()
    settings = get_settings()
    backend = FakeBackend()
    redis = FakeRedis(decode_responses=True)
    http = httpx.AsyncClient(transport=httpx.MockTransport(backend.handler))
    api = KiroyaAPI(settings.api_url, settings.bot_api_secret.get_secret_value(), http=http)
    session = MockedSession()
    bot = Bot(
        "123456:TEST", session=session, default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    dp = build_dispatcher(settings, redis, api)
    yield Harness(bot, dp, session, backend, redis)
    await api.close()
    await redis.aclose()


@pytest.fixture
async def harness(_stand: Harness) -> Harness:
    """Чистое состояние на каждый тест: Redis (токены + FSM), backend, журнал Bot API."""
    await _stand.redis.flushall()
    _stand.backend.routes.clear()
    _stand.backend.calls.clear()
    _stand.session.requests.clear()
    return _stand


def body(request: httpx.Request) -> Any:
    return json.loads(request.content)


def photo() -> Iterator[PhotoSize]:
    yield PhotoSize(file_id="f1", file_unique_id="u1", width=800, height=600)
