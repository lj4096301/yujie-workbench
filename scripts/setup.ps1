$ErrorActionPreference = 'Continue'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  YuJie Workbench - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Project root is the parent folder of this script's folder
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
Write-Host "[INFO] Project root: $root" -ForegroundColor Gray
Write-Host ""

# ---- Node check ----
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js not found. Install Node.js 18+ first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Node.js $(& node -v)" -ForegroundColor Green

# ---- Package manager check (prefer pnpm, fall back to npm) ----
$pm = $null
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pm = 'pnpm'
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $pm = 'npm'
}
if (-not $pm) {
    Write-Host "[ERROR] Neither pnpm nor npm found in PATH." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Package manager: $pm" -ForegroundColor Green
Write-Host ""

# ---- Install dependencies ----
Write-Host "[1/3] Installing dependencies (first time may take a few minutes)..." -ForegroundColor Cyan
& $pm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Install failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# ---- Ensure data directories ----
Write-Host "[2/3] Creating data directories..." -ForegroundColor Cyan
foreach ($d in @('data', 'data\novels', 'data\cache')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $root $d) | Out-Null
}
Write-Host "[OK] data/ ready" -ForegroundColor Green
Write-Host ""

# ---- Verify .env ----
Write-Host "[3/3] Checking configuration..." -ForegroundColor Cyan
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $root '.env.example') $envFile -ErrorAction SilentlyContinue
    Write-Host "[WARN] .env not found, created from .env.example - please fill in your keys." -ForegroundColor Yellow
} else {
    Write-Host "[OK] .env found" -ForegroundColor Green
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Desktop mode : double-click scripts\dev.bat" -ForegroundColor Yellow
Write-Host "  Browser mode : double-click scripts\dev-web.bat" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
