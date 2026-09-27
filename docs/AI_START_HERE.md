# ⚡ ИИ — читай этот файл первым

Если ты ИИ-агент (Claude, Cursor, ChatGPT, Copilot)
и работаешь над проектом KIROYA — читай этот файл
ПЕРЕД любой задачей.

## 1. Что за проект

KIROYA — P2P-платформа аренды вещей в Таджикистане.
Мобильное приложение + Telegram-бот + веб-сайт.

| Папка | Что внутри | Состояние |
|---|---|---|
| `backend/` | FastAPI, PostgreSQL + PostGIS, Redis, Celery, MinIO | работает, тесты есть |
| `bot/` | Telegram-бот на aiogram 3 | работает, тесты есть |
| `web/` | Сайт на Next.js 14: лендинг, каталог, карточка, вход по SMS, профиль | работает, тесты есть |
| `mobile/` | Flutter-приложение | только каркас папок |
| `ml/` | ML-антифрод | только каркас папок |

Python — **3.14** (используется `uuid.uuid7()` из стандартной библиотеки), Node — **20**.

## 2. Порядок работы

Перед каждой задачей:
1. Прочитай [`AI_RULES.md`](AI_RULES.md) — общие правила
2. Прочитай [`ARCHITECTURE.md`](ARCHITECTURE.md) — где что лежит
3. Прочитай [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — если работаешь с UI
4. Прочитай последние 3–5 записей [`WORK_LOG.md`](WORK_LOG.md) — там самые свежие решения и отклонения от ARCHITECTURE
5. Проверь `git status` и `git log --oneline -10`

После задачи:
1. Запусти тесты (см. раздел 7)
2. Обнови `docs/WORK_LOG.md` — добавь запись сверху (шаблон — в начале файла)
3. Сделай коммит по формату (см. ниже)
4. НЕ пушь в `main` напрямую — сделай Pull Request

Документы в `docs/` — офлайн-копии страниц Notion. Если у тебя есть доступ к Notion —
источник правды там, ссылка — в шапке каждого файла.

## 3. Формат коммитов (Conventional Commits)

```
feat(backend/auth): добавил refresh токен
fix(web/hero): исправил переполнение на 375px
docs(readme): обновил инструкцию запуска
refactor(bot/handlers): вынес auth в отдельный роутер
test(backend/reviews): добавил тесты антифрода
chore(deps): обновил fastapi до 0.115
```

Тип: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`
Область: `backend/<модуль>`, `web/<секция>`, `bot/<модуль>`, `docs`
Описание — на русском (AI_RULES §5).

## 4. Ветки

```
main             — только релизные версии, защищена
develop          — рабочая ветка, сюда мёржим PR
feat/<name>      — фичи
fix/<name>       — исправления
docs/<name>      — только документация
```

Новую ветку всегда создавай от свежего `develop`.

## 5. Как открыть Pull Request

```bash
git checkout develop && git pull
git checkout -b feat/booking-cancel
# делай изменения
git add <конкретные файлы>        # не `git add .` вслепую — проверь, что .env не попал
git commit -m "feat(backend/booking): отмена брони арендатором"
git push origin feat/booking-cancel
# На GitHub: New Pull Request → в develop, не в main
```

В описании PR (шаблон подставится сам) указывай:
- Что сделано
- Как проверить
- Ссылку на запись WORK_LOG

## 6. Секреты и безопасность

НИКОГДА не коммить:
- `.env` файлы
- Токены Telegram
- API-ключи (Alif Pay, SMS-провайдер)
- Пароли, `JWT_SECRET_KEY`, `SECRET_KEY`, `BOT_API_SECRET`

Всегда используй `.env.example` как шаблон.
Реальные значения — только у владельца проекта.

Если секрет случайно попал в коммит — не пытайся «тихо» удалить его следующим коммитом:
сразу сообщи владельцу, ключ нужно отозвать и перевыпустить.

Особые зоны (ревью владельца обязательно, см. `.github/CODEOWNERS`):
- `backend/app/services/escrow/` и переходы статусов в `backend/app/services/booking/` — деньги
- `backend/app/services/auth/` — вход и токены
- `.github/` и `docs/`

## 7. Тестирование перед PR

```bash
# Инфраструктура для backend-тестов
docker compose up -d db redis

# Backend
cd backend && pytest -v && ruff check .

# Frontend
cd web && npm run lint && npm test && npm run build

# Bot
cd bot && pytest -v && ruff check .
```

Не открывай PR, если тесты красные. Те же проверки запускает CI (`.github/workflows/ci.yml`).
