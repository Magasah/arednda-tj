# syntax=docker/dockerfile:1.7
FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --system bot && useradd --system --gid bot --home /app bot
WORKDIR /app

# Версии зафиксированы: requirements.txt — экспорт из uv.lock
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Код принадлежит root: процесс bot может его читать, но не менять
COPY . .

USER bot
CMD ["python", "main.py"]

# ---------- Образ для тестов: dev-зависимости, тесты монтируются томом ----------
FROM runtime AS test
USER root
RUN pip install -r requirements-dev.txt
USER bot
CMD ["pytest", "-v", "-p", "no:cacheprovider"]
