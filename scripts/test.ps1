# KIROYA — тесты backend и бота в контейнерах на Windows без make (аналог `make test`).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Invoke-Compose {
    docker compose @args
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Backend-тестам нужны БД и Redis с накатанными миграциями
Invoke-Compose up -d --build --wait backend
Invoke-Compose --profile test run --rm --build backend-tests
Invoke-Compose --profile test run --rm --build bot-tests

Write-Host "Все тесты прошли"
