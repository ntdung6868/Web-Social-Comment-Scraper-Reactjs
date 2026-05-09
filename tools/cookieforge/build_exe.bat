@echo off
cd /d "%~dp0"

echo Dang build CookieForge v3 - Verified Session Exporter (.exe)...
echo.

echo Dang cai dat thu vien can thiet...
:: Cài đặt các thư viện cần thiết để ứng dụng chạy độc lập
python -m pip install pyinstaller customtkinter tkinterdnd2 selenium webdriver-manager
echo.

echo Dang bat dau qua trinh dong goi...
:: pyinstaller command
:: --noconfirm: Xóa thư mục build cũ mà không hỏi
:: --onefile: Đóng gói tất cả thành 1 file .exe duy nhất
:: --windowed: Không hiện cửa số CMD đen khi mở app
:: --collect-all: Đảm bảo đính kèm đầy đủ tài nguyên cua CustomTkinter, TkinterDnD2, va Selenium (lazy imports)
pyinstaller --noconfirm --onefile --windowed ^
  --name "CookieForge" ^
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

if %ERRORLEVEL% equ 0 (
  echo.
  echo [OK] Build xong. File exe nam trong: dist\CookieForge.exe
) else (
  echo.
  echo [LOI] Build that bai. Kiem tra lai cac file Python hoac thu vien PyInstaller.
)

echo.
pause
