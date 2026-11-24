@echo off
title Whisper Agent Setup - ARSS
echo ========================================================
echo   WHISPER AGENT INSTALLER (OFFICIAL ARSS)
echo ========================================================
echo.
echo [1/2] Menyiapkan izin file Windows...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Filter '*.exe' | ForEach-Object { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue }"
echo [2/2] Membuka Installer Whisper Agent...
if exist "%~dp0dist\WhisperWidget-Setup-1.2.0.exe" (
    start "" "%~dp0dist\WhisperWidget-Setup-1.2.0.exe"
) else if exist "%~dp0WhisperWidget-Setup-1.2.0.exe" (
    start "" "%~dp0WhisperWidget-Setup-1.2.0.exe"
) else (
    echo File WhisperWidget-Setup-1.2.0.exe tidak ditemukan di folder ini.
    pause
)
exit
