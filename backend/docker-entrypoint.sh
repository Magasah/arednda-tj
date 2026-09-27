#!/bin/sh
# Точка входа backend-образа: ждём БД → миграции → сид категорий → exec команды контейнера.
# RUN_MIGRATIONS=false — только ожидание БД (Celery, Flower, тесты): миграции катит сервис backend,
# чтобы несколько контейнеров не запускали alembic одновременно.
set -e

DB_HOST="${DB_WAIT_HOST:-db}"
DB_PORT="${DB_WAIT_PORT:-5432}"
DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"

echo "Waiting for postgres at ${DB_HOST}:${DB_PORT}..."
elapsed=0
# Аналог `nc -z host port` на python — не тащим netcat в образ
while ! python -c "import socket,sys; socket.create_connection((sys.argv[1], int(sys.argv[2])), 2).close()" "$DB_HOST" "$DB_PORT" 2>/dev/null; do
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$DB_WAIT_TIMEOUT" ]; then
        echo "Postgres is not reachable after ${DB_WAIT_TIMEOUT}s" >&2
        exit 1
    fi
    sleep 1
done
echo "Postgres is up"

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    alembic upgrade head
    # Идемпотентно (upsert по slug): повторный запуск не дублирует категории
    python scripts/seed_categories.py
fi

exec "$@"
