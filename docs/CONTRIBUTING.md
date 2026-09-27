# Как вносить изменения в KIROYA

Гайд для новых разработчиков и ИИ-агентов. ИИ сначала читает [AI_START_HERE.md](AI_START_HERE.md).

## 1. Окружение

| Инструмент | Версия | Зачем |
|---|---|---|
| Docker Desktop | актуальная | PostgreSQL + PostGIS, Redis, MinIO, Celery |
| Python | **3.14** | backend и бот (`requires-python >= 3.14`, нужен `uuid.uuid7()`) |
| [uv](https://docs.astral.sh/uv/) | ≥ 0.9 | рекомендуемый менеджер пакетов (есть `uv.lock`) |
| Node.js | 20 LTS | web/ (Next.js 14) |
| Git | ≥ 2.40 | — |

### Первый запуск

```bash
git clone https://github.com/Magasah/arednda-tj.git && cd arednda-tj
git checkout develop

cp backend/.env.example backend/.env      # секреты — у владельца проекта
cp bot/.env.example bot/.env
cp web/.env.example web/.env.local

docker compose up -d db redis minio
```

**Backend**

```bash
cd backend
uv sync                                   # или: python -m venv .venv + pip install -r requirements-dev.txt
uv run alembic upgrade head
uv run python -m scripts.seed_categories
uv run uvicorn app.main:app --reload --reload-dir app
```

**Бот**

```bash
cd bot
uv sync                                   # или: pip install -r requirements-dev.txt
uv run python main.py
```

**Web**

```bash
cd web
npm ci
npm run dev
```

### Полезные адреса (локально)

- Swagger: http://localhost:8000/docs
- MinIO Console: http://localhost:9001
- Flower (Celery): http://localhost:5555
- Лендинг: http://localhost:3000

### Зависимости

- Python: добавляй через `uv add <пакет>` (или `uv add --dev`), затем пересобери `requirements*.txt`:
  `uv export --format requirements-txt --no-hashes --no-dev --no-emit-project -o requirements.txt`
  и `uv export --format requirements-txt --no-hashes --only-dev --no-emit-project -o requirements-dev.txt`
  (в начало `requirements-dev.txt` вернуть строку `-r requirements.txt`).
- Node: `npm install <пакет>` — коммитить `package-lock.json`.
- Каждую новую зависимость запиши в WORK_LOG (AI_RULES §4).

## 2. Стиль кода

### Python (backend, bot)

- Линтер и форматтер — **ruff** (форматирование совместимо с black; black отдельно не нужен):
  `ruff check . --fix` и `ruff format .`. Настройки — в `pyproject.toml`, длина строки 100.
- Типы: аннотации везде; в backend — `mypy` (strict, настройки в `pyproject.toml`).
- SQL — только через SQLAlchemy ORM, без сырых запросов. Валидация входа — Pydantic.
- Async везде, где есть I/O. Блокирующие библиотеки — через `asyncio.to_thread`.
- Комментарии — на русском, имена — на английском (snake_case).

### TypeScript (web)

- **ESLint** (`npm run lint`, конфиг `eslint-config-next`) — обязателен, CI падает на ошибках.
- **Prettier** — форматирование с настройками по умолчанию (2 пробела, двойные кавычки);
  отдельного конфига пока нет — не переформатируй чужие файлы целиком без нужды.
- Только токены цвета из `tailwind.config.ts` (стандартная палитра Tailwind отключена) и правила
  [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). `'use client'` — только где нужна интерактивность.
- Комментарии — на русском, имена — на английском (camelCase, компоненты — PascalCase).

### Общее

- Секреты — только в `.env`. Никаких токенов/паролей в коде, тестах, логах и скриншотах.
- `TODO` — только с владельцем и датой: `# TODO(Magasah, 2026-10-15): ...`.
- Не меняй структуру папок и эскроу-логику без согласования (AI_RULES).

## 3. Коммиты

[Conventional Commits](https://www.conventionalcommits.org/ru/), описание — на русском:

```
<тип>(<область>): <что сделано>
```

- Тип: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`
- Область: `backend/<модуль>`, `web/<секция>`, `bot/<модуль>`, `docs`, `deps`, `ci`
- Примеры: `feat(backend/booking): отмена брони арендатором`, `fix(web/hero): переполнение на 375px`
- Один коммит — одно логическое изменение. Перед коммитом смотри `git status` и `git diff --staged`.

## 4. Ветки и Pull Request

```
main        — релизы, защищена, только через PR из develop
develop     — рабочая ветка, сюда идут все PR
feat/<name> | fix/<name> | docs/<name>  — от свежего develop
```

1. `git checkout develop && git pull && git checkout -b feat/<name>`
2. Изменения + тесты + запись в `docs/WORK_LOG.md`
3. `git push origin feat/<name>` → на GitHub **New Pull Request в `develop`**
4. Заполни шаблон PR (подставится автоматически), дождись зелёного CI и ревью
5. Мёрж — squash merge; ветку после мёржа удалить

## 5. Ревью-чеклист

Автор проверяет перед PR, ревьюер — при ревью:

- [ ] CI зелёный: backend-tests, web-build, bot-tests
- [ ] Нет секретов, `.env`, токенов, персональных данных (телефоны, паспорта) в диффе
- [ ] Новые эндпоинты: Pydantic-схемы, проверка прав (владелец/участник), корректные коды ошибок
- [ ] Изменение БД — через Alembic-миграцию; `upgrade → downgrade → upgrade` проходит
- [ ] Деньги/статусы брони: атомарность, блокировки (`SELECT ... FOR UPDATE`), повтор запроса не ломает данные; **эскроу — только с ревью владельца**
- [ ] Есть тесты на новое поведение и на ошибки
- [ ] UI соответствует DESIGN_SYSTEM (цвета, радиусы, тени, 375px без горизонтального скролла)
- [ ] Новые зависимости обоснованы и записаны в WORK_LOG
- [ ] Обновлены docs (ARCHITECTURE — если поменялась структура или API)
- [ ] Запись в `docs/WORK_LOG.md` добавлена
