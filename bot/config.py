"""Настройки бота — только из переменных окружения / .env."""

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    bot_token: SecretStr
    backend_url: str = "http://localhost:8000"
    # Тот же секрет, что BOT_API_SECRET в backend/.env: привязка Telegram и rate limit
    bot_api_secret: SecretStr = SecretStr("")
    # База 4: в backend заняты 0 (кэш/OTP), 1 (rate limit), 2–3 (Celery)
    redis_url: str = "redis://localhost:6379/4"
    environment: str = "development"
    web_url: str = "https://kiroya.tj"

    token_ttl_days: int = 7
    refresh_ttl_days: int = 30
    listings_page_size: int = 5

    @property
    def api_url(self) -> str:
        return f"{self.backend_url.rstrip('/')}/api/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
