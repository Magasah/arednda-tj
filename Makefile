# KIROYA — команды локального окружения (Linux / macOS / Git Bash / WSL).
# Windows без make — те же действия в scripts/*.ps1.
COMPOSE ?= docker compose

.DEFAULT_GOAL := help
.PHONY: help setup up up-bot down logs ps backend-sh db-sh test clean

help: ## Список команд
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-12s %s\n", $$1, $$2}'

setup: ## .env.example → .env + случайные SECRET_KEY, BOT_API_SECRET, WEB_API_SECRET и пароли
	@if [ -f .env ]; then \
		echo ".env уже есть — не трогаю (удали его, чтобы пересоздать)"; \
	else \
		cp .env.example .env; \
		secret=$$(head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n'); \
		bot_secret=$$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'); \
		web_secret=$$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'); \
		password=$$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'); \
		sed -i.bak \
			-e "s|^SECRET_KEY=.*|SECRET_KEY=$$secret|" \
			-e "s|^BOT_API_SECRET=.*|BOT_API_SECRET=$$bot_secret|" \
			-e "s|^WEB_API_SECRET=.*|WEB_API_SECRET=$$web_secret|" \
			-e "s|change_me_in_production|$$password|g" .env; \
		rm -f .env.bak; \
		echo ".env создан, секреты сгенерированы. Дальше: make up"; \
	fi

up: ## Поднять всё (без бота) в фоне
	$(COMPOSE) up -d --build

up-bot: ## Поднять всё вместе с Telegram-ботом (нужен BOT_TOKEN в .env)
	$(COMPOSE) --profile with-bot up -d --build

down: ## Остановить контейнеры (данные в volumes сохраняются)
	$(COMPOSE) --profile with-bot --profile test down

logs: ## Логи всех сервисов
	$(COMPOSE) logs -f

ps: ## Статус контейнеров
	$(COMPOSE) ps

backend-sh: ## Shell внутри контейнера backend
	$(COMPOSE) exec backend sh

db-sh: ## psql внутри контейнера БД
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

test: ## Тесты backend и бота в контейнерах
	$(COMPOSE) up -d --build --wait backend
	$(COMPOSE) --profile test run --rm --build backend-tests
	$(COMPOSE) --profile test run --rm --build bot-tests

clean: ## ОСТОРОЖНО: down + удалить volumes (БД, Redis, MinIO — всё будет стёрто)
	$(COMPOSE) --profile with-bot --profile test down -v --remove-orphans
