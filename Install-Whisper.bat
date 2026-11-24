@echo off
title Whisper Agent Setup - ARSS
echo ========================================================
echo   WHISPER AGENT INSTALLER (OFFICIAL ARSS)
echo ========================================================
echo.
echo [1/2] Menyiapkan izin file Windows...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Filter '*.exe' | ForEach-Object { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue }"
echo [2/2] Membuka Installer Whisper Agent...
for %%F in ("%~dp0dist\WhisperWidget-Setup-*.exe" "%~dp0WhisperWidget-Setup-*.exe") do (
    if exist "%%~F" (
        start "" "%%~F"
        exit
    )
)
echo File installer WhisperWidget-Setup-*.exe tidak ditemukan di folder ini.
pause
exit
