@echo off
cd /d "%~dp0"

echo Dang build CookieForge v3 - Verified Session Exporter (.exe)...
echo Folder: %CD%
echo.

echo Dang cai dat thu vien can thiet...
python -m pip install pyinstaller customtkinter tkinterdnd2 selenium webdriver-manager Pillow
echo.

if not exist "icon.ico" (
  if exist "make_icon.py" (
    echo Tao icon.ico tu make_icon.py...
    python make_icon.py
  )
)

if not exist "icon.ico" (
  echo [CANH BAO] Khong co icon.ico - exe se dung icon mac dinh.
  echo Build van tiep tuc...
  echo.
  pyinstaller --noconfirm --onefile --windowed --name "CookieForge" ^
    --collect-all customtkinter ^
    --collect-all tkinterdnd2 ^
    --collect-all selenium ^
    --collect-all webdriver_manager ^
    --hidden-import cookie_forge_core ^
    --hidden-import tkinterdnd2 ^
    --hidden-import selenium.webdriver.chrome.webdriver ^
    --hidden-import selenium.webdriver.chrome.service ^
    --hidden-import selenium.webdriver.chrome.options ^
    cookie_forge_gui.py
) else (
  echo [OK] icon.ico - se embed vao .exe
  echo.
  pyinstaller --noconfirm --onefile --windowed --name "CookieForge" ^
    --icon "icon.ico" ^
    --collect-all customtkinter ^
    --collect-all tkinterdnd2 ^
    --collect-all selenium ^
    --collect-all webdriver_manager ^
    --hidden-import cookie_forge_core ^
    --hidden-import tkinterdnd2 ^
    --hidden-import selenium.webdriver.chrome.webdriver ^
    --hidden-import selenium.webdriver.chrome.service ^
    --hidden-import selenium.webdriver.chrome.options ^
    cookie_forge_gui.py
)

if %ERRORLEVEL% equ 0 (
  echo.
  echo [OK] Build xong. File exe: %CD%\dist\CookieForge.exe
  echo.
  echo Neu Windows Explorer hien icon cu, chay lenh nay de refresh icon cache:
  echo   ie4uinit.exe -ClearIconCache
  echo Hoac restart Explorer.
) else (
  echo.
  echo [LOI] Build that bai. Kiem tra log o tren.
)

echo.
pause
