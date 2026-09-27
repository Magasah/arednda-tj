# KIROYA — запуск всего окружения на Windows без make (аналог `make up` / `make up-bot`).
#   scripts\up.ps1            — без бота
#   scripts\up.ps1 -WithBot   — вместе с Telegram-ботом (нужен BOT_TOKEN в .env)
param([switch]$WithBot)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path ".env")) {
    & "$PSScriptRoot\setup.ps1"
}

$composeArgs = @()
if ($WithBot) { $composeArgs += @("--profile", "with-bot") }
$composeArgs += @("up", "-d", "--build")

docker compose @composeArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Готово:"
Write-Host "  http://localhost:3000       — сайт"
Write-Host "  http://localhost:8000/docs  — Swagger"
Write-Host "  http://localhost:9001       — MinIO Console"
Write-Host "  http://localhost:5555       — Flower"
