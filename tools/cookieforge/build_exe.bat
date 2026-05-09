@echo off
REM Build CookieForge cho Windows -> CookieForge.exe (onefile)
REM Chay tren Windows da cai Python 3.10+
REM Cach dung: double-click hoac chay trong cmd: build_exe.bat

setlocal EnableExtensions
chcp 65001 >nul 2>nul

set "APP_NAME=CookieForge"
set "SCRIPT_DIR=%~dp0"

REM Bo dau \ cuoi cho de so sanh
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

cd /d "%SCRIPT_DIR%"

echo ================================================
echo   Build %APP_NAME%.exe
echo ================================================
echo Script dir: %SCRIPT_DIR%
echo Working dir: %CD%
echo.

REM 1. Bao loi neu .bat dang nam trong C:\Windows (PyInstaller se tu chiu)
echo %CD% | findstr /I /R /C:"^C:\\Windows" >nul
if not errorlevel 1 (
  echo [LOI] File .bat dang nam trong C:\Windows.
  echo PyInstaller tu choi build trong system folder.
  echo Hay copy folder CookieForge ra ngoai, vi du:
  echo   C:\Users\%USERNAME%\Downloads\CookieForge-main\
  echo Sau do double-click build_exe.bat tu day.
  goto :end_fail
)

REM 2. Kiem tra source files co day du
if not exist "cookie_forge_gui.py" (
  echo [LOI] Khong thay cookie_forge_gui.py trong %CD%
  echo Bao dam file .bat va 2 file .py o cung 1 thu muc.
  goto :end_fail
)
if not exist "cookie_forge_core.py" (
  echo [LOI] Khong thay cookie_forge_core.py trong %CD%
  goto :end_fail
)

REM 3. Kiem tra Python co trong PATH
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

REM 4. Cai dependencies
echo Dang cai dat thu vien (lan dau ~3-5 phut)...
python -m pip install --upgrade pip
if errorlevel 1 (
  echo [LOI] Khong upgrade duoc pip.
  goto :end_fail
)

python -m pip install pyinstaller customtkinter tkinterdnd2 selenium webdriver-manager
if errorlevel 1 (
  echo [LOI] Cai dependencies that bai.
  goto :end_fail
)
echo.

REM 5. Build .exe — ep duong dan tuyet doi cho --workpath/--distpath/--specpath
REM de PyInstaller khong dung CWD ngam (tranh false-positive C:\Windows check).
set "WORK_DIR=%SCRIPT_DIR%\build"
set "DIST_DIR=%SCRIPT_DIR%\dist"

echo Dang build %APP_NAME%.exe (lan dau ~2-3 phut)...
echo Spec/work: %WORK_DIR%
echo Output:    %DIST_DIR%
echo.

python -m PyInstaller --noconfirm ^
  --onefile ^
  --windowed ^
  --name "%APP_NAME%" ^
  --workpath "%WORK_DIR%" ^
  --distpath "%DIST_DIR%" ^
  --specpath "%SCRIPT_DIR%" ^
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
  echo [LOI] PyInstaller build that bai. Doc log o tren.
  goto :end_fail
)

if not exist "%DIST_DIR%\%APP_NAME%.exe" (
  echo [LOI] Khong thay file %DIST_DIR%\%APP_NAME%.exe sau khi build.
  goto :end_fail
)

echo.
echo ================================================
echo   THANH CONG
echo ================================================
echo File: %DIST_DIR%\%APP_NAME%.exe
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
