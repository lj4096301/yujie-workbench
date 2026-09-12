@echo off
chcp 65001 >nul
powershell -ExecutionPolicy Bypass -File "%~dp0dev.ps1" -Web
pause
