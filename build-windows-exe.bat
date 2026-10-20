@echo off
REM ============================================================
REM  GeStock — Build de l'installateur Windows (.exe NSIS)
REM  Produits :
REM    release\GeStock-Setup-1.0.0.exe   (installateur)
REM    release\win-unpacked\GeStock.exe (version portable)
REM ============================================================
setlocal
cd /d "%~dp0"

echo [1/4] Verification de Node.js...
node -v >nul 2>&1
if errorlevel 1 (
  echo ERREUR : Node.js n'est pas installe ou pas dans le PATH.
  pause
  exit /b 1
)

echo [2/4] Installation des dependances...
call npm install
if errorlevel 1 goto :error

echo [3/4] Generation de l'icone...
call npm run icon
if errorlevel 1 goto :error

echo [4/4] Build application + installateur...
call npm run dist:win
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  Installateur genere : release\GeStock-Setup-1.0.0.exe
echo  Double-cliquez dessus pour installer GeStock
echo  (raccourci bureau + menu Demarrer + icone).
echo ============================================================
pause
exit /b 0

:error
echo.
echo ECHEC du build — voir les messages ci-dessus.
pause
exit /b 1
