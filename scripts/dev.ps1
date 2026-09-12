param(
    [switch]$Web
)

$ErrorActionPreference = 'Continue'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  YuJie Workbench - Launcher" -ForegroundColor Cyan
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

# ---- Dependencies ----
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host "[1/2] node_modules missing, installing dependencies (may take a few minutes)..." -ForegroundColor Yellow
    & $pm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Dependency install failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "[1/2] Dependencies already installed" -ForegroundColor Green
}

# ---- Ensure data directories ----
foreach ($d in @('data', 'data\novels', 'data\cache')) {
    $p = Join-Path $root $d
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}
Write-Host ""

# ---- Start ----
if ($Web) {
    Write-Host "[2/2] Starting in BROWSER mode" -ForegroundColor Cyan
    Write-Host "      Web UI : http://localhost:5173" -ForegroundColor Green
    Write-Host "      API    : http://localhost:3001" -ForegroundColor Green
    Write-Host "      Press Ctrl+C in this window to stop." -ForegroundColor Gray
    Write-Host ""
    & $pm run dev:web
} else {
    Write-Host "[2/2] Starting in DESKTOP mode (Electron)" -ForegroundColor Cyan
    Write-Host "      Dev UI : http://localhost:5173" -ForegroundColor Green
    Write-Host "      API    : http://localhost:3001" -ForegroundColor Green
    Write-Host "      Tip: run scripts\dev-web.bat to launch in a browser instead." -ForegroundColor Gray
    Write-Host ""
    & $pm run dev:electron
}

Write-Host ""
Write-Host "YuJie Workbench stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"
