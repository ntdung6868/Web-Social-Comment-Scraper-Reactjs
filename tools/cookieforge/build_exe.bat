@echo off
title CookieForge Build
cd /d "%~dp0"

echo === CookieForge Build ===
echo Folder: %CD%
echo.

python --version
if errorlevel 1 (
    echo [LOI] Khong tim thay python. Cai Python 3.10+ va TICK "Add to PATH".
    pause
    exit /b 1
)

echo Cai thu vien...
python -m pip install --upgrade pip pyinstaller customtkinter tkinterdnd2 selenium webdriver-manager
if errorlevel 1 (
    echo [LOI] pip install that bai.
    pause
    exit /b 1
)

echo.
echo Build CookieForge.exe...
python -m PyInstaller --noconfirm --onefile --windowed --name CookieForge --collect-all customtkinter --collect-all tkinterdnd2 --collect-all selenium --collect-all webdriver_manager --hidden-import cookie_forge_core --hidden-import selenium.webdriver.chrome.webdriver --hidden-import selenium.webdriver.chrome.service --hidden-import selenium.webdriver.chrome.options --hidden-import selenium.webdriver.common.by --hidden-import selenium.webdriver.support.ui --hidden-import selenium.webdriver.support.expected_conditions cookie_forge_gui.py

if errorlevel 1 (
    echo [LOI] PyInstaller build that bai.
    pause
    exit /b 1
)

echo.
echo === XONG ===
echo File: %CD%\dist\CookieForge.exe
echo.
pause
