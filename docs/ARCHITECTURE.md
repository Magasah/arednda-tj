> Источник правды: [Notion — KIROYA ARCHITECTURE](https://app.notion.com/p/3e6346849cad81f2adebc980ccec48b7)
> Этот файл — офлайн копия. При расхождениях верь Notion.

# 🏗️ KIROYA — ARCHITECTURE (структура проекта)

> Читай этот файл перед любой работой с кодом, структурой или API.

> ⚠️ **Фактическое состояние кода новее этого документа.** Реализованные отклонения
> (PostgreSQL 17, `web/`, вход через `/auth/send-otp` вместо register/login, эндпоинты
> `/bookings/*` вместо `/escrow/*` и `/handover/*`, `services/users`, `services/analytics`,
> расширенная структура `bot/`) описаны в [`WORK_LOG.md`](WORK_LOG.md).
> Полный список эндпоинтов — в Swagger: http://localhost:8000/docs.

---

## 📁 Структура папок проекта

```
kiroya/
├── backend/                  # FastAPI бэкенд
│   ├── app/
│   │   ├── main.py               # точка входа FastAPI
│   │   ├── core/
│   │   │   ├── config.py         # настройки (от .env)
│   │   │   ├── security.py       # JWT, хеширование
│   │   │   └── database.py       # подключение PostgreSQL
│   │   ├── services/             # микросервисы
│   │   │   ├── auth/             # регистрация, JWT, верификация
│   │   │   ├── listings/         # объявления аренды
│   │   │   ├── booking/          # бронирование, календарь
│   │   │   ├── escrow/           # эскроу: заморозка, разморозка
│   │   │   ├── reviews/          # рейтинги, отзывы, ML-антифрод
│   │   │   ├── notifications/    # push, Telegram, SMS
│   │   │   └── media/            # фото-акт, S3/MinIO
│   │   ├── models/               # SQLAlchemy ORM модели
│   │   ├── schemas/              # Pydantic валидация
│   │   └── api/
│   │       └── v1/               # REST эндпоинты
│   ├── migrations/               # Alembic миграции БД
│   ├── tests/                    # pytest
│   └── .env.example              # шаблон .env
├── mobile/                   # Flutter приложение
│   ├── lib/
│   │   ├── main.dart
│   │   ├── core/             # конфиг, константы, router
│   │   ├── features/
│   │   │   ├── auth/         # вход, регистрация
│   │   │   ├── home/         # главный экран, поиск
│   │   │   ├── listing/      # карточка вещи, добавление
│   │   │   ├── booking/      # бронирование
│   │   │   ├── escrow/       # QR-скан, фото-акт
│   │   │   ├── profile/      # личный кабинет, рейтинг
│   │   │   └── chat/         # внутренний чат
│   │   └── shared/           # общие виджеты, тема, utils
│   └── pubspec.yaml
├── bot/                      # Telegram-бот (aiogram)
│   ├── main.py
│   ├── handlers/             # обработчики команд
│   ├── keyboards/            # inline клавиатуры
│   └── services/             # API клиент к backend
├── ml/                       # ML-антифрод
│   ├── fraud_detector.py     # классификатор поведения
│   ├── trust_scorer.py       # скоринг доверия
│   └── training/             # данные для обучения
└── docker-compose.yml        # локальный запуск
```

---

## 🗄️ База данных — таблицы

| Таблица | Описание |
|---|---|
| `users` | пользователи: id, phone, name, avatar, trust_score, verified, created_at |
| `listings` | объявления: id, owner_id, title, description, category, price_per_day, deposit, location(PostGIS), photos[], status |
| `bookings` | бронирования: id, listing_id, renter_id, start_date, end_date, total_price, deposit_amount, status |
| `escrow_txns` | эскроу-транзакции: id, booking_id, amount, deposit, status (frozen/released/returned), provider |
| `handovers` | передача: id, booking_id, photos_before[], photos_after[], qr_code, confirmed_at |
| `reviews` | отзывы: id, booking_id, from_user, to_user, rating, text, fraud_score |
| `categories` | категории: id, name_ru, name_tj, icon |

---

## 🔗 API эндпоинты (`/api/v1/`)

| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/register` | регистрация по номеру |
| POST | `/auth/verify-otp` | подтверждение SMS кода |
| POST | `/auth/login` | вход, выдача JWT |
| GET | `/listings` | список (фильтр: категория, гео, даты) |
| POST | `/listings` | создать объявление |
| GET | `/listings/{id}` | деталь |
| POST | `/bookings` | забронировать |
| POST | `/escrow/freeze` | заморозить депозит + аренда |
| POST | `/escrow/release` | разморозить после возврата |
| POST | `/handover/start` | начало передачи + фото до |
| POST | `/handover/confirm` | QR-подтверждение |
| POST | `/handover/return` | возврат + фото после |
| POST | `/reviews` | оставить оценку |
| GET | `/users/{id}/profile` | профиль + рейтинг |

---

## 🔐 Статусы бронирования

```
PENDING → PAYMENT_FROZEN → ACTIVE → RETURN_PENDING → COMPLETED
                                              ↓
                                          DISPUTED → RESOLVED
```

---

## ⚙️ Окружение

| Сервис | Деталь |
|---|---|
| PostgreSQL 15 | основная БД, PostGIS для геопоиска |
| Redis 7 | кеш, статусы online, очередь уведомлений |
| MinIO | хранение фото вещей и фото-актов |
| Celery + Redis | отложенные задачи (напоминания, автосписание) |
| Alif Pay API | заморозка/разморозка средств |
| Firebase FCM | push-уведомления на мобильный |

---

## 📦 Категории вещей (MVP)

1. Техника (ноутбук, планшет, телефон, камера)
2. Инструменты (перфоратор, сварочный аппарат)
3. Транспорт (велосипед, самокат)
4. Мероприятия (проектор, микрофон, освещение)
5. Одежда и аксессуары
