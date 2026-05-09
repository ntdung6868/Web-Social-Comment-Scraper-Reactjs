@echo off
REM Build CookieForge cho Windows -> CookieForge.exe (onefile)
REM Chay tren Windows da cai Python 3.10+
REM Cach dung: double-click hoac chay trong cmd: build_exe.bat

setlocal EnableExtensions
chcp 65001 >nul 2>nul
cd /d "%~dp0"

set "APP_NAME=CookieForge"

echo ================================================
echo   Build %APP_NAME%.exe
echo ================================================
echo.

REM 1. Kiem tra Python co trong PATH
where python >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay python trong PATH.
  echo Cai Python 3.10+ tu https://www.python.org/downloads/
  echo Khi cai nho TICK "Add Python to PATH" o man hinh dau tien.
  goto :end_fail
)

echo [OK] Python:
python --version
echo.

REM 2. Cai dependencies
echo Dang cai dat thu vien (lan dau co the lau ~3-5 phut)...
python -m pip install --upgrade pip
if errorlevel 1 (
  echo [LOI] Khong upgrade duoc pip.
  goto :end_fail
)

python -m pip install pyinstaller customtkinter tkinterdnd2 selenium webdriver-manager
if errorlevel 1 (
  echo [LOI] Cai dependencies that bai. Thuong la do mang hoac proxy.
  echo Thu chay lai voi proxy: set HTTPS_PROXY=http://your-proxy:port
  goto :end_fail
)
echo.

REM 3. Build .exe
REM Selenium dung lazy imports cho webdriver - phai --collect-all de PyInstaller
REM bundle het submodules; neu chi --hidden-import selenium se thieu chrome.webdriver.
echo Dang build %APP_NAME%.exe (lan dau ~2-3 phut)...
python -m PyInstaller --noconfirm ^
  --onefile ^
  --windowed ^
  --name "%APP_NAME%" ^
  --collect-all customtkinter ^
  --collect-data customtkinter ^
  --collect-all tkinterdnd2 ^
  --collect-all selenium ^
  --collect-all webdriver_manager ^
  --hidden-import cookie_forge_core ^
  --hidden-import tkinterdnd2 ^
  --hidden-import _tkinter ^
  --hidden-import selenium.webdriver ^
  --hidden-import selenium.webdriver.chrome ^
  --hidden-import selenium.webdriver.chrome.webdriver ^
  --hidden-import selenium.webdriver.chrome.service ^
  --hidden-import selenium.webdriver.chrome.options ^
  --hidden-import selenium.webdriver.common ^
  --hidden-import selenium.webdriver.common.by ^
  --hidden-import selenium.webdriver.support ^
  --hidden-import selenium.webdriver.support.ui ^
  --hidden-import selenium.webdriver.support.expected_conditions ^
  cookie_forge_gui.py

if errorlevel 1 (
  echo.
  echo [LOI] PyInstaller build that bai. Xem log o tren.
  goto :end_fail
)

if not exist "dist\%APP_NAME%.exe" (
  echo [LOI] Khong thay file dist\%APP_NAME%.exe sau khi build.
  goto :end_fail
)

echo.
echo ================================================
echo   THANH CONG
echo ================================================
echo File: %CD%\dist\%APP_NAME%.exe
echo Double-click file do de mo CookieForge.
echo.
goto :end_ok

:end_fail
echo.
echo Build that bai. Doc loi o tren, fix, roi chay lai.
echo.
pause
endlocal
exit /b 1

:end_ok
pause
endlocal
exit /b 0
