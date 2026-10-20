@echo off
chcp 65001 >nul
title GeStock - Serveur
cd /d "%~dp0"

echo ==============================================================
echo   GeStock - Serveur local
echo   Application : http://localhost:8787
echo   Base        : server\data\gestock.db (SQLite)
echo   Arret       : Ctrl+C ou fermer cette fenetre
echo ==============================================================
echo.

REM Ouvre le navigateur apres le demarrage du serveur (~3 s)
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:8787'"

node server\index.mjs

echo.
echo Serveur arrete.
pause
