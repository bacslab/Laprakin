@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo =====================================================
echo         LAPRAKIN FIGMA LANDING - TANPA NPM INSTALL
echo =====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum ditemukan.
  echo Install Node.js versi 22 atau lebih baru, lalu buka file ini lagi.
  echo Paket ini SUDAH membawa node_modules. Jangan jalankan npm install.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%A in ('node -p "process.versions.node"') do set NODE_MAJOR=%%A
if %NODE_MAJOR% LSS 22 (
  echo Node.js kamu terlalu lama. Laprakin membutuhkan Node.js 22 atau lebih baru.
  node -v
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Folder runtime node_modules tidak lengkap.
  echo Extract ZIP sepenuhnya, jangan jalankan dari dalam ZIP.
  echo.
  pause
  exit /b 1
)

if not exist "client\dist\index.html" (
  echo Build client tidak ditemukan. Extract ZIP secara lengkap lalu coba lagi.
  echo.
  pause
  exit /b 1
)

if not exist "server\.env" copy "server\.env.example" "server\.env" >nul
set NODE_ENV=development
set SERVE_STATIC=true
set PORT=5173
set APP_URL=http://localhost:5173
set API_URL=http://localhost:5173
set ALLOWED_ORIGINS=http://localhost:5173

echo Menjalankan Laprakin di http://localhost:5173
echo Tidak perlu npm install. Jangan tutup jendela ini saat aplikasi digunakan.
echo.
start "" http://localhost:5173
node server\src\index.js

echo.
echo Server berhenti. Tekan tombol apa saja untuk menutup.
pause >nul
