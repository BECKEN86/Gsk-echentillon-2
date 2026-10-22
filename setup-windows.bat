@echo off
chcp 65001 >nul
title GeStock - Installation Windows
cd /d "%~dp0"

echo ==============================================================
echo   GeStock - Installation Windows (SQLite local)
echo ==============================================================
echo.

REM ---- 1. Verification de Node.js (>= 22 requis pour node:sqlite)
where node >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js n'est pas installe ou absent du PATH.
  echo          Telechargez Node.js 22 LTS ou superieur :
  echo          https://nodejs.org/
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 22 (
  echo [ERREUR] Node.js %NODE_MAJOR% detecte - version 22+ requise (module node:sqlite).
  pause
  exit /b 1
)
echo [OK] Node.js detecte :
node -v
echo.

REM ---- 2. Installation des dependances
echo [1/2] Installation des dependances npm...
call npm install
if errorlevel 1 (
  echo [ERREUR] Echec de npm install.
  pause
  exit /b 1
)
echo.

REM ---- 3. Construction de l'application web
echo [2/2] Compilation de l'application (vite build)...
call npm run build
if errorlevel 1 (
  echo [ERREUR] Echec de la compilation.
  pause
  exit /b 1
)
echo.

echo ==============================================================
echo   Installation terminee.
echo.
echo   La base SQLite sera creee au premier lancement.
echo   Vous configurerez le compte administrateur dans l'application.
echo.
echo   Lancement : double-cliquez sur start-gestock.bat
echo   puis ouvrez http://localhost:8787
echo ==============================================================
pause
