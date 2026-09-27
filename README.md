# KIROYA — Аренда вещей в Таджикистане

**KIROYA (Кироя)** — первая P2P-платформа аренды вещей в Таджикистане (старт — Душанбе).
Люди сдают друг другу технику, инструменты, транспорт и вещи для мероприятий.
Деньги и залог замораживаются на эскроу до возврата вещи, передача фиксируется
фото-актом, а рейтинг доверия защищает обе стороны сделки.

**Платформы:** веб-сайт (лендинг) · Telegram-бот · мобильное приложение (Flutter, в планах).

![Лендинг kiroya.tj](web/design/screenshot-home-half.png)

## Стек

| Часть | Технологии |
|---|---|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2 (async) + asyncpg, Alembic, Pydantic 2 |
| Данные | PostgreSQL 17 + PostGIS, Redis 7, MinIO (S3) |
| Фоновые задачи | Celery + Redis, Flower |
| Авторизация | Номер телефона + SMS-код (OTP), JWT (access + refresh) |
| Web | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Бот | aiogram 3, httpx, Redis FSM |
| Инфраструктура | Docker Compose, GitHub Actions |

## Ссылки

- Сайт: https://kiroya.tj
- Telegram-бот: [@kiroyoa_bot](https://t.me/kiroyoa_bot)
- API-документация (локально): http://localhost:8000/docs
- Flower (локально): http://localhost:5555

## Структура репозитория

```
web/       Next.js лендинг (kiroya.tj)
backend/   FastAPI + PostgreSQL + Redis + Celery
bot/       Telegram-бот (aiogram 3)
mobile/    Flutter-приложение (каркас, ещё не начато)
ml/        ML-антифрод (каркас)
docs/      Документация и правила
design/    Логотипы, макеты, дизайн-система (web/design — макеты лендинга)
.github/   CI, шаблон PR, CODEOWNERS
```

## Быстрый старт для разработчика

Требования: Docker Desktop, Python 3.14+, Node 20+.
Рекомендуется [uv](https://docs.astral.sh/uv/) — `pyproject.toml` и `uv.lock` есть в `backend/` и `bot/`.

```bash
git clone https://github.com/Magasah/arednda-tj.git
cd arednda-tj
```

**1. Скопируй `.env` файлы из `.env.example`** и заполни значения (секреты запроси у владельца проекта):

```bash
cp backend/.env.example backend/.env
cp bot/.env.example bot/.env
cp web/.env.example web/.env.local
```

**2. Запусти инфраструктуру**

```bash
docker compose up -d db redis minio
```

**3. Backend** (http://localhost:8000/docs)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS/Linux
pip install -r requirements-dev.txt
alembic upgrade head
python -m scripts.seed_categories
uvicorn app.main:app --reload --reload-dir app
```

Код входа по SMS в режиме `ENVIRONMENT=development` не отправляется, а пишется в лог backend.

**4. Frontend** (http://localhost:3000)

```bash
cd web
npm install
npm run dev
```

**5. Telegram-бот** (нужен `BOT_TOKEN` от @BotFather в `bot/.env`)

```bash
cd bot
python -m venv .venv && source .venv/bin/activate   # или .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

**Всё в Docker одной командой:** `docker compose up -d --build` (backend, Celery, Flower);
бот — `docker compose --profile bot up -d bot`.

## Тесты

```bash
cd backend && pytest -v       # нужны db и redis из docker compose
cd bot && pytest -v
cd web && npm run lint && npm run build
```

## Для ИИ-агентов (Claude, Cursor, ChatGPT)

Читай [`docs/AI_START_HERE.md`](docs/AI_START_HERE.md) перед любой работой.

## Документация

- [docs/AI_START_HERE.md](docs/AI_START_HERE.md) — точка входа для ИИ
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — структура кода
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — цвета, компоненты
- [docs/AI_RULES.md](docs/AI_RULES.md) — правила для ИИ
- [docs/WORK_LOG.md](docs/WORK_LOG.md) — история изменений
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — окружение, стиль кода, коммиты, PR

## Лицензия

Proprietary. Все права защищены KIROYA Team.
