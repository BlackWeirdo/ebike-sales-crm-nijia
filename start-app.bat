@echo off
chcp 65001 >nul
cd /d "%~dp0"
title App Quan ly cua hang Xe Dap Dien
echo ==================================================
echo    APP QUAN LY CUA HANG XE DAP DIEN
echo    Dia chi: http://localhost:3001
echo ==================================================
echo.

REM --- Kiem tra Node.js da cai chua ---
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Node.js tren may nay.
  echo Hay tai va cai Node.js phien ban 24 LTS tai: https://nodejs.org
  echo Cai xong, mo lai file nay.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)

REM --- Cai thu vien lan dau ---
if not exist "node_modules" (
  echo [SETUP] Cai dat thu vien lan dau, vui long doi vai phut...
  call npm install
  if errorlevel 1 (
    echo [LOI] Cai thu vien that bai. Kiem tra ket noi mang roi thu lai.
    pause
    exit /b 1
  )
)

REM --- Build giao dien (chi lan dau; sau khi cap nhat code thi xoa thu muc "dist" de build lai) ---
if not exist "dist\index.html" (
  echo [BUILD] Dang chuan bi giao dien lan dau...
  call npm run build
  if errorlevel 1 (
    echo [LOI] Build that bai. Chup man hinh nay va bao lai.
    pause
    exit /b 1
  )
)

echo.
echo Khoi dong server... Trinh duyet se tu mo sau vai giay.
echo De DUNG app: dong cua so nay hoac nhan Ctrl + C.
echo.

REM Mo trinh duyet sau 4 giay (cho server san sang)
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3001"

REM Chay server (giu cua so nay mo trong khi dung app)
call npm start

echo.
echo Server da dung.
pause
