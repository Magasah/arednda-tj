"""Точка входа Telegram-бота KIROYA (long polling)."""

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import RedisStorage
from aiogram.types import BotCommand
from redis.asyncio import Redis

from api.client import KiroyaAPI
from config import Settings, get_settings
from handlers import build_router
from middlewares.auth import SessionMiddleware
from services.session import TokenStore

COMMANDS = [
    BotCommand(command="start", description="Главное меню"),
    BotCommand(command="listings", description="Найти вещь"),
    BotCommand(command="bookings", description="Мои брони"),
    BotCommand(command="profile", description="Мой профиль"),
    BotCommand(command="help", description="Помощь"),
]


def build_dispatcher(settings: Settings, redis: Redis, api: KiroyaAPI) -> Dispatcher:
    store = TokenStore(redis, settings.token_ttl_days, settings.refresh_ttl_days)
    # FSM в Redis: состояние входа не теряется при перезапуске бота
    dp = Dispatcher(storage=RedisStorage(redis), api=api, store=store)
    dp.update.outer_middleware(SessionMiddleware(api, store))
    dp.include_router(build_router())
    return dp


async def main() -> None:
    settings = get_settings()
    logging.basicConfig(
        level=logging.INFO if settings.environment == "development" else logging.WARNING,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    api = KiroyaAPI(settings.api_url, settings.bot_api_secret.get_secret_value())
    bot = Bot(
        settings.bot_token.get_secret_value(),
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = build_dispatcher(settings, redis, api)

    try:
        await bot.set_my_commands(COMMANDS)
        # start_polling сам обрабатывает SIGINT/SIGTERM и завершает опрос
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await api.close()
        await dp.storage.close()
        await redis.aclose()
        await bot.session.close()
        logging.getLogger("kiroya.bot").info("Бот остановлен, соединения закрыты")


if __name__ == "__main__":
    asyncio.run(main())
