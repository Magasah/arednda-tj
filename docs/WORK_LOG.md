> Источник правды: [Notion — KIROYA WORK_LOG](https://app.notion.com/p/3e6346849cad810f996cd3f46232283d)
> Этот файл — офлайн копия. При расхождениях верь Notion.

# 📝 KIROYA — WORK_LOG (журнал работ ИИ)

> Каждый ИИ **ОБЯЗАН** добавить запись после завершения задачи.
> Читай последние 5 записей перед началом новой задачи.
---
## Шаблон отчёта (копируй и заполняй)
```
## [YYYY-MM-DD HH:MM] — [НАЗВАНИЕ ЗАДАЧИ]
- Задача: что было поручено
- Что сделал: по пунктам что именно
- Файлы изменены: backend/app/services/auth/router.py, ...
- Статус: ЗАВЕРШЕНО
- Следующий шаг: что нужно сделать дальше
```
---
## 🟢 Записи работ (newest first)
## [2026-09-27 12:00] — GIT-РЕПОЗИТОРИЙ, ДОКУМЕНТАЦИЯ, CI
- Задача: подготовить репозиторий, чтобы любой ИИ или разработчик мог клонировать и начать работу: .gitignore, README, docs/, CONTRIBUTING, .env.example, GitHub Actions, шаблон PR, CODEOWNERS, первый push (main + develop)
- Что сделал:
  - .gitignore в корне (секреты, Python, Node, IDE, загрузки, тяжёлые исходники дизайна) + .gitattributes (LF в репозитории)
  - README.md — описание, стек, структура, быстрый старт, тесты, ссылки на docs/
  - docs/AI_START_HERE.md — точка входа для ИИ (порядок работы, коммиты, ветки, PR, секреты, тесты); docs/CONTRIBUTING.md — окружение, стиль (ruff / eslint + prettier), коммиты, PR, ревью-чеклист
  - docs/AI_RULES.md, ARCHITECTURE.md, DESIGN_SYSTEM.md, WORK_LOG.md — офлайн-копии Notion (шапка «Источник правды: Notion»). В ARCHITECTURE — пометка, что актуальные отклонения в WORK_LOG
  - .env.example: backend — без изменений (все переменные уже были), bot — BOT_TOKEN=your_bot_token_here, web — новый (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL; лендинг их пока не читает)
  - bot/requirements-dev.txt (экспорт из uv.lock) — для CI
  - .github/workflows/ci.yml: backend-tests (PostGIS 17 + Redis как services, ruff, alembic upgrade head, pytest), web-build (npm ci, lint, build), bot-tests (ruff, pytest); .github/pull_request_template.md; .github/CODEOWNERS
  - git init, remote origin, 2 коммита, push main + develop
- Отклонения от ТЗ: Python 3.14 вместо 3.12 в CI и README (pyproject требует ≥ 3.14, код использует uuid.uuid7 из stdlib); форматтер Python — ruff format (совместим с black, отдельный black не нужен); prettier в web без конфига (в проекте не настроен — не добавлял зависимость); backend в CI ставит requirements-dev.txt (в requirements.txt нет pytest); seed — `python -m scripts.seed_categories`; в коммит 2 добавлены mobile/ и ml/ (каркас папок)
- Проверено локально: backend 101/101 (в том числе без MinIO — как в CI), bot 16/16, ruff backend/bot — чисто, web lint — чисто; в индексе нет .env
- Файлы: .gitignore, .gitattributes, README.md, docs/{AI_START_HERE,AI_RULES,ARCHITECTURE,DESIGN_SYSTEM,WORK_LOG,CONTRIBUTING}.md, .github/{workflows/ci.yml,pull_request_template.md,CODEOWNERS}, web/.env.example, bot/.env.example, bot/requirements-dev.txt
- Статус: ЗАВЕРШЕНО (защиту веток владелец включает вручную на github.com)
- Следующий шаг: владелец — branch protection для main/develop; дальше вся работа через ветки feat/* → PR в develop; синхронизировать docs/ с Notion при изменениях; обновить ARCHITECTURE по фактической структуре
---
## [2026-09-27 10:00] — TELEGRAM-БОТ (aiogram 3)
- Задача: бот как второй вход в платформу: /start, вход по SMS-коду, каталог, брони, профиль, уведомления backend → Telegram
- Что сделал (bot/, 34 файла):
  - uv-проект: aiogram 3.31, redis 8.1, httpx 0.28, pydantic-settings 2.15 (версии из ТЗ не ставятся на Python 3.14); requirements.txt из uv.lock; Dockerfile (non-root)
  - api/client.py — KiroyaAPI (эндпоинты из ТЗ) + UserSession: токен из Redis, при 401 — автообновление через refresh (access живёт 15 мин), иначе токены удаляются и бот просит войти
  - services/session.py — Redis: bot:token (7 дней), bot:refresh (30 дней), bot:phone
  - middlewares/auth.py — SessionMiddleware (сессия в каждом апдейте) + AuthRequiredMiddleware (защищённые роутеры → «Войти»)
  - handlers: start (приветствие с баннером, меню, /help, /cancel, обработка ошибок API/недоступного backend), auth (FSM: телефон текстом или контактом — только своим), listings (категории, карточки, пагинация, подробно с фото, профиль владельца, бронирование с выбором дат), booking (список renter/owner, оплата, отмена, фото при получении/возврате, подтверждение возврата владельцем, отзыв), profile (имя, выход), notifications (вкл/выкл)
  - main.py — polling, FSM в RedisStorage, команды бота, закрытие httpx/Redis/сессии при остановке
  - docker-compose: сервис bot в профиле bot (без токена не стартует), env_file необязательный
- Изменения backend:
  - BOT_API_SECRET (X-Bot-Secret): для запросов бота rate limit send-otp считается по X-Telegram-User-Id (иначе все пользователи бота делили бы 1 вход/мин)
  - POST /users/me/telegram (только с секретом бота, перенос привязки) и DELETE /users/me/telegram — вместо PATCH telegram_chat_id из ТЗ (любой клиент мог бы присвоить чужой chat_id); поле — существующее users.telegram_id
  - POST /bookings/{id}/cancel (арендатор, pending) — для кнопки «❌ Отменить»
  - Уведомления: HTML-шаблоны из ТЗ, parse_mode=HTML, render() экранирует данные; MeResponse.telegram_linked
- Проверено: бот 16/16 (Telegram — MockedSession, backend — MockTransport, Redis — fakeredis), backend 101/101. E2E против настоящего backend и Redis (подменён только канал до Telegram): /start → вход → токены в Redis → telegram_id в БД → категория с реальными объявлениями → брони → профиль. E2E нашёл баг (сбой привязки оставлял FSM в «жду код») — исправлен, есть регрессионный тест
- Отклонения: Redis база 4 (1 занята rate limit backend); «❤️ В избранное» — алерт (в backend нет избранного); «➕ Разместить» — ссылка на сайт; фото объявлений бот скачивает сам (Telegram не видит localhost/MinIO); структура bot/ расширена (api, states, middlewares, utils)
- Не сделано (требует владельца): создание бота в @BotFather и BOT_TOKEN, скриншоты из Telegram; TELEGRAM_BOT_TOKEN в backend/.env для реальной отправки уведомлений
- Файлы: bot/ — 34 новых; backend — 1 новый (tests/test_bot_support.py), 11 изменённых (config, limiter, notifications/service, users/{router,service,schemas}, booking/{router,service}, tasks/booking_tasks, .env.example, .env); docker-compose.yml
- Статус: ЗАВЕРШЕНО (запуск в настоящем Telegram — после BOT_TOKEN)
- Следующий шаг: владелец создаёт бота и вписывает токен; таджикский язык в боте (users.language); webhook вместо polling для прода; избранное в backend; обновить ARCHITECTURE (bot/, новые эндпоинты)
---
## [2026-09-27 08:10] — ОТЗЫВЫ, АНТИФРОД, TRUST SCORE, ПРОФИЛЬ, АНАЛИТИКА
- Задача: 4 эндпоинта отзывов, антифрод, trust score, /users/me + верификация, аналитика для admin, Celery-задачи, теги Swagger
- Что сделал:
  - POST /reviews (только участник completed-сделки, один раз, ≤ 14 дней; 403/409 по ТЗ), GET /reviews/user/{id} (avg + rating_distribution), GET /reviews/listing/{id} (отзывы об арендаторах), DELETE /reviews/{id} (автор, ≤ 24 ч, soft)
  - services/reviews/fraud.py — FraudDetector, 5 правил из ТЗ (взаимные +0.3, новый аккаунт +0.25, слишком быстро +0.2, паттерн оценок +0.35, короткая пятёрка +0.1); ≥ 0.7 → is_hidden. Правило взаимности симметрично — пересчитывается и встречный отзыв
  - services/reviews/trust.py — формула из ТЗ (base + бонусы − штрафы, clamp 1..5, без отзывов 4.0), кэш trust:{id} 1 ч (инвалидация после commit). Штрафы за споры — только арендатору (к нему претензия), доля скрытых — от полученных отзывов
  - Новый пакет services/users/ (профиль перенесён из listings): GET/PATCH /users/me (имя, аватар → avatars/{id}/), POST /users/me/verify (ЗАГЛУШКА: автоподтверждение), профиль + trust_breakdown, reviews_summary, response_rate
  - services/analytics/ — GET /analytics/platform (role=admin, комиссия 10% с completed, топ категорий/городов, кэш 5 мин)
  - Celery: review_tasks.send_review_reminder (через 2 ч после completed, только тем, кто не написал), recalculate_all_trust_scores (ночью)
  - Swagger: теги Auth/Listings/Booking/Escrow/Reviews/Users/Analytics с описаниями, description API из ТЗ
  - Миграция 0005: users.passport_verified(+_at, photo_key), trust_score → Numeric(3,2) 1..5 (существующим = 4.00), bookings.completed_at (backfill), reviews.is_hidden/is_deleted/deleted_at
- Отклонения от ТЗ (с причинами):
  - is_verified в API = паспорт (новое поле passport_verified). Старое users.verified = «телефон подтверждён OTP», оно true у всех — иначе +0.2 получал бы каждый
  - is_admin — свойство поверх существующего users.role=admin (без новой колонки)
  - Beat пересчёта — crontab(hour=3), а не 22: timezone Celery = Asia/Dushanbe, crontab в местном времени
  - Фото паспорта — в private/ (бакет публичен только для listings/avatars/handovers), в API не отдаётся
  - response_rate = % возвратов, подтверждённых владельцем за 24 ч (шага «принять бронь» в сделке нет)
  - test_fraud_mutual_reviews: одно правило взаимности даёт ровно 0.3; «\> 0.3» — вместе с правилом короткой пятёрки (веса не менял)
- Проверено: 96/96 тестов (новых 20: reviews 16, users 4); сценарий на живом сервере — сделка completed, взаимные отзывы (fraud 0.55, видимы), trust_breakdown в профиле, аналитика (выручка 85.00 = 10% от 850)
- Файлы: 13 новых (reviews/{fraud,trust}, users/{__init__,stats,schemas,service,router}, analytics/{__init__,router}, tasks/review_tasks, migration 0005, tests/{test_reviews,test_users}), 24 изменённых (модели user/review/booking, config, storage, security, celery_app, main, api router, reviews/listings/booking/auth сервисы, booking_tasks, conftest, test_auth, .env.example, .gitignore, .dockerignore)
- Статус: ЗАВЕРШЕНО
- Следующий шаг: ручная модерация паспортов (admin-очередь вместо автоподтверждения); admin: решение споров и модерация скрытых отзывов; ML-модель антифрода (ml/) на размеченных данных; обновить ARCHITECTURE (services/users, services/analytics, эндпоинты)
---
## [2026-09-26 16:30] — BOOKING + ESCROW + CELERY: ПОЛНЫЙ ЦИКЛ СДЕЛКИ
- Задача: бронирование → заморозка → передача → возврат → выплата; споры, фото-акты, Celery, уведомления в Telegram
- ⚠️ ТРЕБУЕТСЯ РЕВЬЮ КОМАНДЫ (AI_RULES: эскроу-логика): services/escrow/service.py и переходы в services/booking/service.py. Провайдер замокан (MOCK_*), реальных денег нет — до подключения Alif Pay нужно ревью
- Что сделал:
  - 8 эндпоинтов /bookings: создание (201 + payment_url + expires_at), список (role renter/owner), детали (только участники), confirm-payment, handover, return, confirm-return, dispute
  - Защита от гонок: SELECT FOR UPDATE на объявлении при создании брони + EXCLUDE в БД; SELECT FOR UPDATE на брони и эскроу на каждом переходе + проверка статуса (повтор → 409); SKIP LOCKED в фоновых задачах
  - EscrowService: freeze / release(release_deposit) / partial_release (удержание не больше депозита) / calculate_penalty (цена × 2 × дни просрочки, по времени Душанбе). Штраф при подтверждении good → partial_returned
  - Период брони — \start_date, end_date): end_date = день возврата, не оплачивается и свободен для следующего арендатора (согласовано с формулой цены из ТЗ). Фильтр дат ленты и is_available — та же семантика
  - Модели HandoverRecord (handovers), Dispute (disputes); escrow_txns + payout_amount, deposit_refund_amount, deposit_returned_at. Миграция 0004 (+ CHECK end\>start, EXCLUDE по [)); upgrade/downgrade/upgrade, alembic check — ок
  - Celery: core/celery_[app.py (acks_late, prefetch 1, таймзона Asia/Dushanbe) + beat: cancel_expired_bookings (5 мин), auto_confirm_return (15 мин, через 48 ч), send_return_reminder (ежедневно 10:00); точная автоотмена — задача с countdown 15 мин. Задачи — в своём event loop с NullPool. Публикация из API не ломает запрос при недоступном брокере
  - NotificationService: Telegram Bot API (TELEGRAM_BOT_TOKEN), иначе лог; шаблоны BOOKING_RECEIVED / PAYMENT_FROZEN / RETURN_PENDING / REVIEW_REMINDER (+ напоминание о возврате, спор, автоотмена). Отправка после ответа (BackgroundTasks). Поле telegram_chat_id НЕ добавлено — используется users.telegram_id (для личного чата chat_id = user id)
  - docker-compose: celery_worker, celery_beat, flower (один образ kiroya-backend:local; адреса redis переопределены для docker-сети). Исправлен краш backend-контейнера (нет прав на /app/uploads)
  - StorageService.upload_many — общая атомарная загрузка для объявлений и фото-актов
- Проверено: 76/76 тестов (test_booking — 21, включая реальную гонку двух транзакций, 10/10 прогонов). Сценарий против API в Docker: pending→payment_frozen→active→return_pending→completed, escrow frozen→released (payout 450, депозит 2000 возвращён). Flower: 1 воркер online, задачи succeeded
- Новые зависимости: celery[redis] 5.6.3, flower 2.2.0 (версии из ТЗ не поддерживают Python 3.14), kombu 5.6.2 (закреплена стабильная — uv подтягивал 5.7.0a1), tzdata → runtime
- Файлы: 12 новых (models/{handover,dispute}, core/{timeutils,celery_app}, tasks/{__init__,dispatch,runtime,booking_tasks,notification_tasks}, migration 0004, tests/{test_booking,helpers}), 24 изменённых (booking/escrow/notifications/listings сервисы, модели, config, main, storage, conftest, docker-compose, Dockerfile, requirements и др.)
- Открытые вопросы: payment_method=cash — наличные платформа не может заморозить, сейчас это только запись; решение споров (admin-эндпоинт + partial_release) не сделано; Flower без авторизации (для прода — basic-auth/VPN)
- Статус: ЗАВЕРШЕНО (эскроу — ожидает ревью)
- Следующий шаг: ревью эскроу → интеграция Alif Pay (webhook оплаты вместо confirm-payment, идемпотентность по provider_tx_id); admin: решение споров; POST /reviews; QR-подтверждение передачи (qr_code в handovers)
---
## [2026-09-26 16:00] — LISTINGS: CRUD, ФОТО (MinIO), ГЕОПОИСК, КЭШ, ПРОФИЛЬ
- Задача: 7 эндпоинтов объявлений + /users/{id}/profile, хранилище фото, кэш Redis, тесты, проверка в Swagger и MinIO
- Что сделал:
  - core/storage.py — StorageService (minio-py в asyncio.to_thread): upload_file → listings/{listing_id}/{uuid4}.{ext}, delete_file, get_public_url; бакет создаётся автоматически, публичное чтение без листинга; формат по сигнатуре файла (JPEG/PNG/WebP), лимит 10 МБ при чтении (413); на dev без MinIO — backend/uploads/ (+ защита от path traversal при удалении)
  - core/cache.py — CacheService (get/set/delete/delete_pattern через SCAN); сбой Redis = промах. categories:all 1 ч, listing:{id} 5 мин, инвалидация при PATCH/DELETE/фото
  - listings: GET (category, city, гео lat/lng/radius через ST_DWithin, date_from/to, min/max_price, page/limit≤50), GET /{id} (+owner, is_available), POST multipart (1–8 фото, 201), PATCH, DELETE (soft), POST /{id}/photos, DELETE /{id}/photos/{index}, GET /categories; все мутации — только владелец (403), во время аренды — 409; SELECT FOR UPDATE при правках; при ошибке БД загруженные фото удаляются
  - GET /users/{id}/profile: UserShort (без телефона — публичный эндпоинт), stats (total_deals, disputes, return_rate_percent), 10 активных объявлений, 5 отзывов. Роутер users_router — в services/listings (новая папка сервиса не создавалась)
  - Рейтинг вещи = средняя оценок арендаторов по броням этого объявления
  - Миграция 0003: ex_bookings_no_overlap теперь держит даты только в pending/payment_frozen/active/return_pending/disputed (раньше — все кроме cancelled: после досрочного возврата оставшиеся дни нельзя было сдать). Фильтр дат в ленте использует тот же набор
  - Поле geom НЕ добавлено: уже есть listings.location (geography, вычисляется из lat/lng, GIST). Geometry SRID 4326 в ST_DWithin считает расстояние в градусах, а не метрах — дубль был бы лишним и опасным
  - docker-compose: сервис minio (секреты из backend/.env). Образ minio/minio удалён с Docker Hub, quay.io — 401 → cgr.dev/chainguard/minio:latest (тот же MinIO, RELEASE.2026-09-22)
  - Swagger: теги Listings/Users/Auth/..., summary/description/response_description, примеры в схемах; для list[UploadFile] добавлен format: binary — иначе Swagger (OpenAPI 3.1) не показывал выбор файлов
  - Тесты: 12 из ТЗ + гео, даты, цена/пагинация, 409 во время аренды, фото, пересечение броней (18) + storage/cache (10). Весь backend: 55/55
  - Вручную: categories=5 (кэш TTL 3600), POST /listings в Swagger → 201, фото в бакете kiroya-listings (159 473 байт, публичный URL → 200), фильтр city=Душанбе → 1
- Новые зависимости: minio 7.2.20, python-multipart
- Файлы: новые — app/core/{storage,cache}.py, migrations/versions/*0003_booking_holding_statuses.py, tests/test_storage_cache.py; изменены — app/core/config.py, app/main.py, app/models/booking.py, app/api/v1/{router,health}.py, app/services/listings/{router,service,schemas}.py, роутеры auth/booking/escrow/reviews/notifications (теги), tests/test_listings.py, scripts/seed_categories.py, pyproject.toml, uv.lock, requirements{,-dev}.txt, .env.example, docker-compose.yml, .gitignore
- Известно: MinIO Console при первом входе требует подтвердить лицензию AGPL v3 — решение владельца (для прода оценить AGPL vs S3-совместимые альтернативы). Кэш карточки 5 мин — is_available может быть устаревшим до 5 минут после брони (инвалидировать в booking-сервисе)
- Статус: ЗАВЕРШЕНО
- Следующий шаг: Booking-сервис (POST /bookings: расчёт стоимости, инвалидация listing:{id}); сжатие/ресайз фото и удаление EXIF (геометки в фото!); обновить ARCHITECTURE (эндпоинты listings/users, MinIO-образ)
---
## [2026-09-26 15:30] — AUTH: OTP ЧЕРЕЗ SMS + JWT
- Задача: полная авторизация по номеру телефона: send-otp, verify-otp, refresh, me, logout; rate limit; тесты
- Что сделал:
  - services/auth/otp.py — OTPService: код secrets.randbelow(900000)+100000; в Redis хранится HMAC-хеш кода (otp:{phone}, TTL 5 мин); otp_attempts:{phone} (TTL 15 мин, \>5 → 429 и код сжигается); otp_cooldown:{phone} 60 с (SET NX) — защита от SMS-бомбинга с разных IP. На development код только логируется; в проде без SMS_API_KEY → 503
  - core/security.py — verify_token (→ UUID, 401), blacklist по jti в Redis (TTL = остаток срока), get_current_user / CurrentUser через HTTPBearer (в Swagger — кнопка Authorize с токеном; OAuth2PasswordBearer не подходит — паролей нет)
  - services/auth/router.py — 5 эндпоинтов; send-otp: slowapi 1/minute на IP; verify-otp авторегистрирует (verified=True), is_new_user; logout отзывает access и (опционально) refresh
  - services/auth/users.py — доступ к users (гонка при параллельном входе обработана); в тестах подменяется in-memory
  - schemas: SendOTPRequest (+992, 13 символов; местные 9 цифр нормализуются), VerifyOTPRequest, RefreshRequest, LogoutRequest, TokenResponse, UserResponse
  - core/limiter.py (slowapi, RATE_LIMIT_STORAGE_URI: memory:// или redis://), core/redis.py — зависимость get_redis/RedisDep; main.py — limiter + обработчик RateLimitExceeded
  - Тесты tests/test_auth.py: 10 из ТЗ + брутфорс OTP + unit (телефон, код, JWT, HMAC) = 24; fakeredis, без реальной БД. Весь набор backend — 35/35
  - Вручную в Swagger: send-otp → код в логе → verify-otp (200, is_new_user=true) → Authorize → /auth/me 200
- Новые зависимости: slowapi 0.1.10, limits 5.8 (3.13 из ТЗ устарела), httpx → runtime; dev: fakeredis. requirements{,-dev}.txt пересобраны
- Файлы: новые — app/core/limiter.py, app/services/auth/{otp,users}.py; изменены — app/core/{security,config,redis}.py, app/main.py, app/schemas/common.py, app/services/auth/{router,schemas}.py, tests/{test_auth,conftest}.py, pyproject.toml, uv.lock, requirements{,-dev}.txt, .env.example
- Известно: формат запроса к SMS-шлюзу (esms.uz) не сверен с документацией провайдера — нужен выбранный таджикский шлюз и его API
- Статус: ЗАВЕРШЕНО
- Следующий шаг: выбрать SMS-провайдера Таджикистана и подключить его API; POST /listings (теперь есть CurrentUser); GET /users/{id}/profile; обновить ARCHITECTURE (auth: send-otp/refresh/me/logout вместо register/login)
---
## [2026-09-26 15:10] — BACKEND: МОДЕЛИ, МИГРАЦИЯ, СЕРВИСЫ, ЗАПУСК
- Задача: структура сервисов, config, все модели, main.py + /health, .env/compose, requirements, миграция, seed категорий, запуск
- Подход: backend уже был инициализирован (запись 2026-09-25 16:30) — дополнен, не пересоздан (AI_RULES §1)
- Что сделал:
  - config.py: DATABASE_URL (приоритет) или POSTGRES_*; SECRET_KEY/ALGORITHM/ACCESS_TOKEN_EXPIRE_MINUTES принимаются как алиасы JWT_*; ALIF_PAY_*, SMS_*; ENVIRONMENT=development; CORS по умолчанию localhost:3000 + kiroya.tj
  - database.py: get_db, реэкспорт Base (DeclarativeBase вместо устаревшего declarative_base)
  - security.py: JWT access/refresh (PyJWT, type+jti), OTP через secrets + HMAC-SHA256
  - Модели: categories, listings, bookings, escrow_txns, reviews (users — без изменений). UUIDv7 PK, деньги Numeric(12,2), статусы VARCHAR+CHECK
  - listings: city + lat/lng, PostGIS location — вычисляемая колонка из lat/lng + GIST-индекс
  - bookings: EXCLUDE-ограничение ex_bookings_no_overlap (btree_gist) — БД не даст забронировать одну вещь на пересекающиеся даты; добавлен статус resolved (из ARCHITECTURE)
  - reviews: unique(booking_id, from_user_id) вместо unique(booking_id) — обе стороны сделки оставляют отзыв; CHECK rating 1..5, from ≠ to
  - Сервисы auth/listings/booking/escrow/reviews/notifications: router + schemas + service. Реальные эндпоинты: GET /listings (фильтры: category, city, гео lat/lng/radius_km, свободные даты, пагинация), GET /listings/{id}, GET /listings/categories (новый — добавить в ARCHITECTURE). Остальные роутеры — каркас со схемами
  - main.py: версия 1.0.0, /health → {status, db}, проверка БД в lifespan
  - Миграция 0002_initial_tables (autogenerate + ручная правка: import geoalchemy2, btree_gist, дубли CHECK). env.py больше не пытается удалять таблицы PostGIS Tiger. upgrade/downgrade/upgrade — ок, alembic check — без расхождений
  - scripts/seed_categories.py — 5 категорий, идемпотентно (ON CONFLICT slug)
  - docker-compose (корень проекта, как в ARCHITECTURE): сервис postgres → db
  - requirements.txt / requirements-dev.txt — экспорт из uv.lock
  - Тесты: 24 шт. (JWT, OTP, нормализация телефона +992, фильтры ленты, геопоиск, запрет пересекающихся броней); интеграционные — в транзакции с откатом
- Отклонения от ТЗ: версии библиотек из ТЗ (fastapi 0.115, pydantic 2.9, asyncpg 0.29) не ставятся на Python 3.14 — оставлены текущие; python-jose → PyJWT (jose заброшен, CVE); passlib не нужен (паролей нет, OTP); uuid7 вместо uuid4; users не изменена (verified, trust_score 0..100); postgis 17 вместо 15; compose в корне, а не в backend/
- Новые зависимости: pyjwt; dev: tzdata
- Запуск: docker compose up -d db redis → alembic upgrade head → seed → uvicorn --reload. /health = {"status":"ok","db":"connected"}, /docs открывается (скриншот backend/docs/screenshots/swagger-docs.png)
- Файлы: новые — app/core/security.py, app/schemas/common.py, app/models/{category,listing,booking,escrow,review}.py, app/services/*/{router,schemas,service}.py, scripts/{__init__,seed_categories}.py, migrations/versions/*0002_initial_tables.py, tests/{test_auth,test_listings}.py, requirements{,-dev}.txt, .env (локальный), docs/screenshots/*; изменены — app/core/{config,database,logging}.py, app/main.py, app/models/{base,__init__}.py, app/api/v1/router.py, migrations/env.py, .env.example, pyproject.toml, uv.lock, tests/{conftest,test_health}.py, docker-compose.yml, .gitignore
- Статус: ЗАВЕРШЕНО
- Следующий шаг: Auth-сервис (/auth/register, /auth/verify-otp, /auth/login: OTP в Redis с TTL и rate-limit, SMS-шлюз); таблица handovers (есть в ARCHITECTURE, не было в ТЗ); обновить ARCHITECTURE (web/, GET /listings/categories, PostgreSQL 17)
---
## [2026-09-25 22:30] — OG-IMAGE, КОНФИГ ИЗОБРАЖЕНИЙ, NO-JS ФОЛБЭК
- Задача: og:image в метаданные, SvgIcon, производительность, robots/sitemap, build + проверка
- Что сделал:
  - og-image.png (был 1730×909, 1.9 MB) → 1200×630, 333 KB; оригинал сохранён в web/design/og-image-source.png. В layout.tsx добавлены openGraph.images и twitter.images
  - next.config.mjs: images.formats avif/webp, compress: true (фото Hero теперь отдаётся в AVIF)
  - Найден баг: блоки FadeInUp приходят с сервера с opacity 0 — без JS (боты, медленная сеть до гидратации) секции пустые. Добавлен data-fade + noscript-стиль в layout
  - Пропущено как уже сделанное/вредное: SvgIcon (дубль Icon.tsx; Hero-бейджи уже на kiroya-иконках), preconnect к Google Fonts (next/font хостит Inter сам, запросов к Google нет), public/robots.txt (конфликтует с app/robots.ts), якоря секций в sitemap (поисковики игнорируют #fragment). \<img\> тегов нет, next/image ленивый по умолчанию
- Проверено: npm run build (CMD) — без ошибок и warning'ов; npm run start; og:image + twitter:image в \<head\>; Network — 0 ошибок (10/10 запросов 200); консоль чистая; полностраничный скриншот web/design/screenshot-home.png
- Известно: ссылки футера /help, /about, /terms, /privacy → 404 при клике (страниц ещё нет)
- Файлы изменены: web/src/app/layout.tsx, web/next.config.mjs, web/src/components/ui/FadeInUp.tsx, web/public/images/og-image.png, web/design/{og-image-source.png, screenshot-home.png, screenshot-home-half.png} (новые)
- Статус: ЗАВЕРШЕНО
- Следующий шаг: страницы футера (или убрать ссылки до запуска); решить контраст accent; удалить или использовать images/hero-bg.png и phone-mockup.png (не используются, 3.6 MB в public)
---
## [2026-09-25 22:00] — КАСТОМНЫЕ SVG-ИКОНКИ KIROYA
- Задача: набор собственных SVG-иконок, компоненты Icon/KiroyaIcon, замена Lucide на лендинге
- Что сделал:
  - Изучил web/public/svgicons (75 файлов, смешанные стили и зашитые цвета — для KIROYA не годятся)
  - Нарисовал 16 иконок в web/public/svgicons/kiroya/ (24×24, stroke currentColor 1.5, round caps/joins, без фона): key, shield-check, photo-act, handshake, clock-money, laptop, wrench, scooter, camera, tent, star-badge, location-pin, qr-scan, deposit, verified + home (для категории «Для дома»)
  - src/lib/kiroyaIcons.ts — список имён + тип KiroyaIconName (опечатка в имени = ошибка типов)
  - Icon.tsx — серверный inline-SVG через fs.readFileSync, цвет через text-*, кеш, whitelist имён в рантайме (защита от path traversal)
  - KiroyaIcon.tsx — внешний .svg через CSS mask-image + bg-current (точный цвет из палитры; next/image + CSS filter не использован — filter даёт только приблизительный цвет, а \<img\> не наследует currentColor)
  - Лендинг: Hero-бейджи (text-primary), HowItWorks (белые в синих кругах), Categories (text-accent), Safety (белые в синих кругах + ring-surface/25, иначе круг сливается с синим фоном), HeroEscrowCard — на иконки KIROYA. Lucide остался только в кнопке (стрелка), мобильном меню и мокапе телефона
  - Badge: убран проп tone, иконка всегда primary
- Проверено: tsc, eslint, next build — без ошибок; в браузере цвета иконок = #1A5276 / #FFFFFF / #E67E22 по ТЗ; иконки сверены визуально на контрольном листе
- Файлы изменены: web/public/svgicons/kiroya/*.svg (16, новые), web/src/lib/kiroyaIcons.ts, web/src/components/ui/{Icon, KiroyaIcon, Badge}.tsx, web/src/components/sections/{Hero, HeroEscrowCard, HowItWorks, StepCard, Categories, CategoryCard, Safety, SafetyFeature}.tsx
- Статус: ЗАВЕРШЕНО
- Следующий шаг: те же иконки в Flutter (flutter_svg + colorFilter); подключить images/og-image.png в metadata.openGraph; решить, нужны ли images/hero-bg.png и phone-mockup.png (добавлены вручную, не используются)
---
## [2026-09-25 21:00] — ЛЕНДИНГ: ДОВОДКА ДО ПРОДАКШН
- Задача: реальное фото в Hero, SEO-метаданные, scroll-анимации, Lighthouse, мобильная версия, favicon
- Что сделал:
  - Hero: фото гор Таджикистана (Unsplash, Oziel Gómez, Unsplash License) на весь блок, next/image fill + priority + quality 60; оверлей — сплошной bg-background/85 (без градиента — DS запрещает). SVG-горы удалены. source.unsplash.com мёртв (503) — фото взято напрямую с images.unsplash.com
  - layout.tsx: title/description/keywords/openGraph (ru_TJ)/twitter/robots/canonical/icons. viewport оставлен отдельным экспортом (в metadata он deprecated в Next 14)
  - Добавлены robots.txt и sitemap.xml (app/robots.ts, app/sitemap.ts)
  - Анимации: Reveal → FadeInUp (y 24, 200ms easeOut, whileInView once, margin -80px, stagger index × 0.08s, reduced-motion). Длительность 200ms вместо 350ms — по DS, согласовано с владельцем. Применено: заголовок Hero, 3 шага, 6 категорий (теперь покарточно), 3 карточки Safety, CTA
  - Favicon: public/icon.svg (App Icon по DS — синий фон, белый ключ, оранжевые стрелки, радиус 22.5%), favicon.ico (16/32/48), apple-icon.png 180. Удалён дефолтный src/app/favicon.ico от Next
  - Мобайл: кнопки сторов в CTA на 100% ширины. Проверено на 375px: h1 не обрезается, шаги/Safety в 1 колонку, hero-кнопки 100%, меню перекрывает контент, Esc закрывает, нет горизонтального скролла
- Lighthouse (production build, Chrome, без инъекции антивируса): мобайл Performance 91 / Accessibility 96 / SEO 100; десктоп Performance 99 / Accessibility 96. Best Practices 82 — из-за скрипта Kaspersky, который антивирус вставляет в каждую страницу на этом ПК (http-запрос), не из-за сайта
- Известная проблема: белый текст на #E67E22 = 2.85:1 (ниже WCAG AA 4.5:1); то же для оранжевых цен на белом и бейджа депозита. Это цвета из DS — нужно решение владельца бренда
- Новые зависимости: sharp (оптимизация next/image в проде + генерация favicon)
- Файлы изменены: web/src/app/layout.tsx, web/src/app/robots.ts (новый), web/src/app/sitemap.ts (новый), web/src/app/favicon.ico (удалён), web/src/components/ui/FadeInUp.tsx (новый, заменил Reveal.tsx), web/src/components/ui/StoreButton.tsx, web/src/components/sections/{Hero, HowItWorks, Categories, Safety, CTA}.tsx, web/public/{icon.svg, favicon.ico, apple-icon.png, images/hero-bg.jpg}, web/public/images/hero-mountains.svg (удалён), web/package.json
- Статус: ЗАВЕРШЕНО
- Следующий шаг: решить вопрос контраста accent; OG-картинка 1200×630 для соцсетей (сейчас summary_large_image без изображения); добавить web/ в ARCHITECTURE; таджикская версия (next-intl)
---
## [2026-09-25 20:00] — ЛЕНДИНГ kiroya.tj (Next.js 14)
- Задача: Лендинг по DESIGN_SYSTEM: Navbar, Hero, Как это работает, Категории, Безопасность, CTA, Footer
- Что сделал:
  - Новый проект `web/` (Next.js 14.2 App Router, TypeScript, Tailwind 3.4, Framer Motion, Lucide)
  - tailwind.config.ts: палитра заменяет стандартные цвета Tailwind → в коде доступны только токены (primary, accent, background, surface, success, ink, muted, border, deposit-bg). Токен текста назван `ink` вместо `text` (чтобы не было `text-text`)
  - Тени/радиусы из DS как токены: shadow-card, shadow-fab, rounded-card (16px), rounded-chip (20px)
  - UI: Button, Badge, Card, Container, SectionHeading, Reveal (200ms ease-out, учитывает prefers-reduced-motion), Logo + LogoMark (SVG: ключ в синем круге + оранжевые стрелки, оранжевая точка под Y), TajikPattern (SVG-орнамент), PhoneFrame (iPhone 15 Pro), StoreButton
  - Hero: мокап телефона собран в коде — экран листинга по DS (геопин «Душанбе», поиск, чипы, карточки с ценой/депозитом/рейтингом, таббар с оранжевым FAB) + плашка «Деньги заморожены»; фон — SVG-иллюстрация гор (public/images/hero-mountains.svg)
  - Трастовые бейджи — иконки Lucide вместо эмодзи (Lock / Camera / Star)
  - Категории: горизонтальный скролл со snap на мобиле, сетка 6 колонок на десктопе, hover — border primary + scale 1.02
  - Мобильное меню (Esc закрывает, aria-expanded), skip-link, focus-ring, якоря с учётом sticky-навбара
  - 'use client' только в Navbar, MobileNav, Reveal
- Проверено: tsc, eslint, `next build` — без ошибок; на 375px нет горизонтального скролла; все вычисленные цвета на странице — из палитры; в консоли нет ошибок
- Новые зависимости (web/): next@14, react@18, tailwindcss@3, framer-motion, lucide-react, clsx, tailwind-merge@2
- Отклонения: новая папка `web/` (в ARCHITECTURE её нет — нужно добавить); фото Душанбе и PNG-мокап iPhone заменены SVG/кодом (готовых ассетов нет)
- Файлы изменены: web/tailwind.config.ts, web/src/app/{layout.tsx, page.tsx, globals.css}, web/src/lib/utils.ts, web/src/components/ui/{Button, Badge, Card, Container, SectionHeading, Reveal, Logo, LogoMark, TajikPattern, PhoneFrame, StoreButton}.tsx, web/src/components/layout/{Navbar, MobileNav, Footer, FooterColumn}.tsx, navLinks.ts, web/src/components/sections/{Hero, HeroAppScreen, HeroListingCard, HeroTabItem, HeroEscrowCard, HowItWorks, StepCard, Categories, CategoryCard, Safety, SafetyFeature, CTA}.tsx, web/public/images/hero-mountains.svg, .claude/launch.json
- Статус: ЗАВЕРШЕНО
- Следующий шаг: добавить `web/` в ARCHITECTURE; заменить hero-mountains.svg на реальное фото Душанбе; реальные ссылки App Store / Google Play после публикации; страницы /help, /terms, /privacy, /about; версия на таджикском (next-intl)
---
## [2026-09-25 16:30] — ИНИЦИАЛИЗАЦИЯ BACKEND (FastAPI + БД + Docker)
- Задача: Создать структуру папок по ARCHITECTURE, инициализировать backend: main.py, core/config.py, core/database.py, .env.example, docker-compose.yml, модель users, Alembic-миграция users
- Что сделал:
  - Создана вся структура папок: backend/, mobile/, bot/, ml/ (пустые модули — .gitkeep / __init__.py)
  - core/config.py — pydantic-settings, все значения из .env, секреты как SecretStr, DSN собирается автоматически
  - core/database.py — async SQLAlchemy 2.0 + asyncpg, настраиваемый пул (pool_size/overflow/recycle/pre_ping), command_timeout, зависимость SessionDep
  - core/redis.py — общий async-пул Redis (hiredis)
  - core/logging.py — structlog (JSON в проде, цветной вывод локально)
  - core/middleware.py — X-Request-ID (чистый ASGI) для трассировки запросов
  - main.py — lifespan (корректное закрытие пулов), GZip, CORS из .env, /docs скрыт в проде, роутер /api/v1
  - api/v1/health.py — /health/live и /health/ready (проверка Postgres + Redis параллельно)
  - models/base.py — naming convention для constraint'ов, UUIDv7 PK (сортируемые по времени), created_at/updated_at
  - models/user.py — users: id, phone (E.164, unique, CHECK), name, avatar_url, trust_score (0..100, CHECK), verified, is_active, role (user/admin), language (ru/tg), telegram_id (unique), created_at, updated_at
  - Alembic (async env), миграция 0001: CREATE EXTENSION postgis + таблица users
  - docker-compose: postgres (postgis 17-3.5), redis 7.4 (AOF), migrate (одноразовый, накатывает миграции), backend; везде healthcheck'и
  - Dockerfile: multi-stage, uv, non-root пользователь, HEALTHCHECK
  - Тесты pytest (3 шт.) — проходят; ruff — чисто; SQL миграции проверен через `alembic upgrade head --sql`
- Новые зависимости: fastapi, uvicorn[standard], pydantic-settings, sqlalchemy[asyncio], asyncpg, alembic, geoalchemy2, redis[hiredis], structlog; dev: pytest, pytest-asyncio, httpx, ruff, mypy. Менеджер пакетов — uv (uv.lock). Python 3.14 (uuid.uuid7 из stdlib)
- Отклонения от ARCHITECTURE: PostgreSQL 17 вместо 15 (новее, быстрее, совместим); в users добавлены поля updated_at, is_active, role, language, telegram_id; avatar → avatar_url
- Файлы изменены: .gitignore, docker-compose.yml, backend/pyproject.toml, backend/uv.lock, backend/Dockerfile, backend/.dockerignore, backend/.env.example, backend/alembic.ini, backend/app/main.py, backend/app/core/{config,database,redis,logging,middleware}.py, backend/app/api/v1/{router,health}.py, backend/app/models/{__init__,base,user}.py, backend/migrations/{env.py,script.py.mako}, backend/migrations/versions/2026_09_25_1600-0001_create_users.py, backend/tests/{conftest,test_health}.py
- Статус: ЗАВЕРШЕНО (запуск в Docker ещё не проверен — на машине не был запущен Docker daemon)
- Следующий шаг: `docker compose up --build` и проверка /api/v1/health/ready; затем Auth сервис (core/security.py JWT, OTP в Redis с rate-limit, /auth/register, /auth/verify-otp, /auth/login)
---
## [2026-09-25 15:46] — ИНИЦИАЛИЗАЦИЯ ПРОЕКТА
- Задача: Создать фундаментные документы для ИИ
- Что сделано:
  - Создан AI_RULES.md (правила для всех ИИ)
  - Создан ARCHITECTURE.md (структура, БД, API)
  - Создан WORK_LOG.md (этот файл)
  - Продумана архитектура и схема БД
  - Выбрано название проекта: KIROYA
  - Составлена презентация (Ijora.pptx, 10 слайдов)
- Файлы изменены: Notion страницы (3 шт.)
- Статус: ЗАВЕРШЕНО
- Следующий шаг: Создать репозиторий + инициализировать бэкенд
---
## 🟡 Текущий статус проекта
| Модуль | Статус | Кто работает |
|---|---|---|
| Проектные документы | ✅ ГОТОВО | Claude |
| Презентация | ✅ ГОТОВО | Claude |
| Backend структура | ✅ ГОТОВО | Claude |
| БД миграции | ✅ ГОТОВО (все таблицы ARCHITECTURE + disputes) | Claude |
| Auth сервис | ✅ ГОТОВО (нужен реальный SMS-шлюз) | Claude |
| Escrow сервис | 🔄 МОК ГОТОВ — ждёт ревью и Alif Pay | Claude |
| Flutter приложение | ⏳ НЕ НАЧАТО | Ожидает ИИ |
| Telegram-бот | ✅ ГОТОВО (нужен BOT_TOKEN от владельца) | Claude |
| ML-антифрод | ⏳ НЕ НАЧАТО | Ожидает ИИ |
