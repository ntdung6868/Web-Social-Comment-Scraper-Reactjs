@echo off
REM Build CookieForge cho Windows -> file CookieForge.exe (onefile)
REM Cach dung: chay file nay tren Windows da cai Python 3.10+
REM   build_exe.bat

setlocal
cd /d "%~dp0"

set APP_NAME=CookieForge

echo Dung Python:
where python
python --version
echo.

REM Cai cac thu vien can thiet
echo Dang cai dat thu vien...
python -m pip install --upgrade pip
python -m pip install pyinstaller customtkinter tkinterdnd2 selenium webdriver-manager
if errorlevel 1 (
  echo Loi cai pip packages
  exit /b 1
)
echo.

echo === Build %APP_NAME%.exe ===

REM Selenium dung lazy imports cho webdriver - phai --collect-all de PyInstaller
REM bundle het submodules; neu chi --hidden-import selenium se thieu chrome.webdriver.
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
  echo ❌ PyInstaller build that bai
  exit /b 1
)

echo.
echo Xong. File: dist\%APP_NAME%.exe
echo Chay file .exe de mo CookieForge va xuat verified-session JSON ra Downloads.
echo.
endlocal
