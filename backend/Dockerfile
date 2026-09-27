# syntax=docker/dockerfile:1.7
# ---------- Сборка зависимостей: gcc и libpq-dev нужны, если у пакета нет готового wheel ----------
FROM python:3.14-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Отдельный venv — в runtime-образ копируется только он, без компилятора
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
# Версии зафиксированы: requirements.txt — экспорт из uv.lock
COPY requirements.txt ./
RUN pip install -r requirements.txt

# ---------- Runtime-образ ----------
FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:$PATH"

# apt здесь не нужен: asyncpg не использует libpq, БД ждём через python (docker-entrypoint.sh)
RUN groupadd --system app && useradd --system --gid app --home /app app
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
# Код принадлежит root: процесс app может его читать, но не менять
COPY pyproject.toml alembic.ini ./
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# chmod здесь, а не в git: на Windows бит исполнения теряется при checkout.
# uploads* — локальный фолбэк хранилища фото (dev без MinIO), пользователь app пишет сюда
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/uploads /app/uploads_private \
    && chown app:app /app/uploads /app/uploads_private

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"

# Миграции + сид, потом CMD. Для Celery миграции выключаются через RUN_MIGRATIONS=false
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-2} --proxy-headers --forwarded-allow-ips='*'"]

# ---------- Образ для тестов: runtime + dev-зависимости. Тесты монтируются томом ----------
FROM runtime AS test
USER root
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
USER app
ENV RUN_MIGRATIONS=false
CMD ["pytest", "-v", "-p", "no:cacheprovider"]
