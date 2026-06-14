@echo off
chcp 65001 >nul
cd /d "%~dp0"
title App Quan ly cua hang Xe Dap Dien
echo ==================================================
echo    APP QUAN LY CUA HANG XE DAP DIEN
echo    Dia chi: http://localhost:3001
echo ==================================================
echo.

REM --- Kiem tra node_modules ---
if not exist "node_modules" (
  echo [SETUP] Cai dat thu vien lan dau, vui long doi...
  call npm install
)

echo [1/2] Build giao dien moi nhat...
call npm run build
if errorlevel 1 (
  echo.
  echo [LOI] Build that bai. Chup man hinh nay va bao lai.
  pause
  exit /b 1
)

echo.
echo [2/2] Khoi dong server... Trinh duyet se tu mo sau vai giay.
echo De DUNG app: dong cua so nay hoac nhan Ctrl + C.
echo.

REM Mo trinh duyet sau 4 giay (cho server san sang)
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3001"

REM Chay server (giu cua so nay mo trong khi dung app)
call npm start

echo.
echo Server da dung.
pause
