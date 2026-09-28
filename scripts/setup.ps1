# KIROYA — первичная настройка на Windows без make (аналог `make setup`).
# Запуск из корня репозитория:  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (Test-Path ".env") {
    Write-Host ".env уже есть — не трогаю (удали его, чтобы пересоздать)"
    exit 0
}

# Криптостойкий генератор; hex — безопасен в URL (DATABASE_URL)
function New-Secret([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

$secret = New-Secret 48
$botSecret = New-Secret 32
$webSecret = New-Secret 32
$password = New-Secret 16

$content = [System.IO.File]::ReadAllText((Resolve-Path ".env.example"))
$content = $content -replace "(?m)^SECRET_KEY=.*$", "SECRET_KEY=$secret"
$content = $content -replace "(?m)^BOT_API_SECRET=.*$", "BOT_API_SECRET=$botSecret"
$content = $content -replace "(?m)^WEB_API_SECRET=.*$", "WEB_API_SECRET=$webSecret"
$content = $content.Replace("change_me_in_production", $password)

# UTF-8 без BOM и с LF — иначе docker compose прочитает первую переменную с мусором
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), $content.Replace("`r`n", "`n"), $utf8NoBom)

Write-Host ".env создан, секреты сгенерированы. Дальше: scripts\up.ps1"
