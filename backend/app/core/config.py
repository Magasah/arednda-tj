"""Настройки приложения. Все значения читаются из переменных окружения / .env."""

from enum import StrEnum
from functools import lru_cache

from pydantic import AliasChoices, Field, PostgresDsn, RedisDsn, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    LOCAL = "local"
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Приложение ---
    app_name: str = "KIROYA API"
    app_version: str = "1.0.0"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "https://kiroya.tj"]
    )
    log_level: str = "INFO"

    # --- PostgreSQL ---
    # DATABASE_URL имеет приоритет; если не задан — собирается из POSTGRES_*
    database_url: str = ""
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "kiroya"
    postgres_password: SecretStr = SecretStr("")
    postgres_db: str = "kiroya"

    # Пул соединений (на один процесс/воркер)
    db_pool_size: int = 20
    db_max_overflow: int = 10
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800
    db_echo: bool = False

    # --- Redis ---
    redis_url: RedisDsn = RedisDsn("redis://localhost:6379/0")
    redis_max_connections: int = 100

    # --- JWT (core/security.py). Принимаются оба варианта имён переменных ---
    jwt_secret_key: SecretStr = Field(
        validation_alias=AliasChoices("JWT_SECRET_KEY", "SECRET_KEY"),
    )
    jwt_algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("JWT_ALGORITHM", "ALGORITHM"),
    )
    jwt_access_token_expire_minutes: int = Field(
        default=15,
        validation_alias=AliasChoices(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "ACCESS_TOKEN_EXPIRE_MINUTES"
        ),
    )
    jwt_refresh_token_expire_days: int = Field(
        default=30,
        validation_alias=AliasChoices("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "REFRESH_TOKEN_EXPIRE_DAYS"),
    )

    # --- Платежи: Alif Pay ---
    alif_pay_api_key: SecretStr = SecretStr("")
    alif_pay_base_url: str = "https://api.alif.tj"

    # --- SMS ---
    sms_api_key: SecretStr = SecretStr("")
    sms_api_url: str = "https://api.esms.uz/main/send/"
    sms_sender: str = "KIROYA"

    # --- OTP ---
    otp_ttl_seconds: int = 300  # срок жизни кода
    otp_max_attempts: int = 5  # попыток ввода кода на номер
    otp_attempts_window_seconds: int = 900  # окно подсчёта попыток
    otp_resend_cooldown_seconds: int = 60  # пауза между SMS на один номер

    # --- Хранилище фото: MinIO (S3-совместимое) ---
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "kiroya"
    minio_secret_key: SecretStr = SecretStr("")
    minio_bucket: str = "kiroya-listings"
    minio_use_ssl: bool = False
    # Базовый URL, по которому клиенты получают фото (в проде — CDN/домен)
    minio_public_url: str = "http://localhost:9000"

    # --- Загрузка фото ---
    upload_max_bytes: int = 10 * 1024 * 1024
    listing_max_photos: int = 8
    local_upload_dir: str = "uploads"

    # --- Бронирование и эскроу ---
    booking_payment_ttl_minutes: int = 15  # сколько ждём оплату брони
    booking_max_days: int = 30
    late_penalty_multiplier: int = 2  # штраф за день просрочки = цена/сутки × N
    return_auto_confirm_hours: int = 48  # владелец молчит → возврат подтверждается
    payment_page_url: str = "https://kiroya.tj/pay"  # заглушка до интеграции Alif Pay

    # --- Отзывы и доверие ---
    review_deadline_days: int = 14  # сколько дней после завершения сделки можно оставить отзыв
    review_delete_hours: int = 24  # сколько часов автор может удалить отзыв
    review_reminder_delay_seconds: int = 2 * 3600

    # --- Аналитика ---
    platform_commission_percent: int = 10

    # --- Celery (фоновые задачи) ---
    celery_broker_url: str = "redis://localhost:6379/2"
    celery_result_backend: str = "redis://localhost:6379/3"
    celery_timezone: str = "Asia/Dushanbe"
    # False — отложенные задачи не публикуются (тесты, локальный запуск без воркера)
    celery_enabled: bool = True

    # --- Telegram-бот (уведомления) ---
    telegram_bot_token: SecretStr = SecretStr("")
    # Общий секрет backend ↔ бот: только бот может привязать telegram_id и получает
    # rate limit по пользователю Telegram, а не по своему IP
    bot_api_secret: SecretStr = SecretStr("")

    # --- Rate limit (slowapi). В проде с несколькими воркерами — Redis ---
    rate_limit_storage_uri: str = "memory://"

    @model_validator(mode="after")
    def _build_database_url(self) -> Settings:
        if not self.database_url:
            if not self.postgres_password.get_secret_value():
                raise ValueError("Задайте DATABASE_URL или POSTGRES_PASSWORD")
            self.database_url = str(
                PostgresDsn.build(
                    scheme="postgresql+asyncpg",
                    username=self.postgres_user,
                    password=self.postgres_password.get_secret_value(),
                    host=self.postgres_host,
                    port=self.postgres_port,
                    path=self.postgres_db,
                )
            )
        elif self.database_url.startswith("postgresql://"):
            # Поддержка обычного DSN — принудительно используем async-драйвер
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION

    @property
    def is_dev(self) -> bool:
        return self.environment in (Environment.LOCAL, Environment.DEVELOPMENT)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
