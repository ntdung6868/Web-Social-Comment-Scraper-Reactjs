#!/bin/bash
# Build CookieForge cho macOS (M1 / Intel) → file .app + .dmg (drag-to-install)
# Cách dùng:
#   ./build_mac.sh           # build cho chip hiện tại (M1 → arm64, Intel → x86_64)

set -e
cd "$(dirname "$0")"

# Tránh lỗi "macOS 26 or later required, have instead 16" khi chạy app
export MACOSX_DEPLOYMENT_TARGET=12.0

# Ưu tiên Python từ python.org để Tcl/Tk ổn định hơn cho GUI CustomTkinter
if [ -x "/Library/Frameworks/Python.framework/Versions/Current/bin/python3" ]; then
  PYTHON="/Library/Frameworks/Python.framework/Versions/Current/bin/python3"
  echo "Dùng Python: $PYTHON"
else
  PYTHON="python3"
fi

# Cài đặt các thư viện cần thiết trước khi build
echo "Đang kiểm tra và cài đặt thư viện..."
$PYTHON -m pip install pyinstaller customtkinter tkinterdnd2 selenium webdriver-manager

APP_NAME="CookieForge"
ARCH="${ARCH:-$(uname -m)}"
if [ "$ARCH" = "arm64" ]; then
  SUFFIX="arm64"
elif [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "i386" ]; then
  SUFFIX="x86_64"
else
  SUFFIX="$ARCH"
fi
DMG_NAME="CookieForge-${SUFFIX}.dmg"

echo "=== Build $APP_NAME cho $ARCH ==="
echo ""

# Build .app bằng PyInstaller (onedir = .app bundle trên macOS).
# Selenium dùng lazy imports cho webdriver — phải --collect-all để PyInstaller
# bundle hết submodules; nếu chỉ --hidden-import selenium sẽ thiếu chrome.webdriver.
# Tao icon.icns neu chua co
if [ ! -f "icon.icns" ] && [ -f "make_icon.py" ] && [ -f "make_icns.sh" ]; then
  echo "Tao icon.icns..."
  $PYTHON make_icon.py
  bash make_icns.sh
fi

ICON_ARG=""
[ -f "icon.icns" ] && ICON_ARG="--icon=icon.icns"

$PYTHON -m PyInstaller --noconfirm \
  --onedir \
  --windowed \
  --name "$APP_NAME" \
  $ICON_ARG \
  --collect-all customtkinter \
  --collect-data customtkinter \
  --collect-all tkinterdnd2 \
  --collect-all selenium \
  --collect-all webdriver_manager \
  --hidden-import cookie_forge_core \
  --hidden-import tkinterdnd2 \
  --hidden-import _tkinter \
  --hidden-import selenium.webdriver \
  --hidden-import selenium.webdriver.chrome \
  --hidden-import selenium.webdriver.chrome.webdriver \
  --hidden-import selenium.webdriver.chrome.service \
  --hidden-import selenium.webdriver.chrome.options \
  --hidden-import selenium.webdriver.common \
  --hidden-import selenium.webdriver.common.by \
  --hidden-import selenium.webdriver.support \
  --hidden-import selenium.webdriver.support.ui \
  --hidden-import selenium.webdriver.support.expected_conditions \
  cookie_forge_gui.py

APP_PATH="dist/${APP_NAME}.app"
if [ ! -d "$APP_PATH" ]; then
  echo "Lỗi: Không thấy $APP_PATH"
  exit 1
fi

echo ""
echo "=== Tạo file .dmg (drag to install layout) ==="
# Detach mọi mount cũ để hdiutil không bị "Resource busy"
for V in "/Volumes/$APP_NAME" "/Volumes/$APP_NAME 1" "/Volumes/$APP_NAME 2" "/Volumes/$APP_NAME 3"; do
  [ -d "$V" ] && hdiutil detach "$V" -force >/dev/null 2>&1 || true
done

# Xóa .dmg cũ nếu có
rm -f "dist/$DMG_NAME"
rm -f "dist/temp.dmg"

# 1) Staging dir: chứa .app + symlink "Applications" để user kéo thả
STAGING="dist/dmg_staging"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -R "$APP_PATH" "$STAGING/"
ln -s /Applications "$STAGING/Applications"

# 2) Tạo DMG read-write, mount, dùng AppleScript để bố cục icon
hdiutil create -size 300m -fs HFS+ -volname "$APP_NAME" \
  -srcfolder "$STAGING" \
  -format UDRW -ov \
  "dist/temp.dmg"

MOUNT_DIR="/Volumes/$APP_NAME"
hdiutil attach "dist/temp.dmg" -readwrite -noverify -noautoopen >/dev/null

# Đợi mount thành công
for _ in 1 2 3 4 5; do
  [ -d "$MOUNT_DIR" ] && break
  sleep 0.5
done

# AppleScript: cửa sổ icon view, ẩn toolbar/sidebar, đặt vị trí icon
# - .app ở (150, 200), Applications symlink ở (450, 200), icon size 128px
# Wrap với timeout dài hơn vì Finder hay chậm khi mới mount disk.
osascript <<EOF || echo "⚠️ AppleScript timeout — DMG vẫn dùng được (drag-to-install qua symlink), chỉ không có layout custom"
with timeout of 120 seconds
  tell application "Finder"
    activate
    delay 2
    tell disk "$APP_NAME"
      open
      delay 3
      set current view of container window to icon view
      set toolbar visible of container window to false
      set statusbar visible of container window to false
      try
        set sidebar width of container window to 0
      end try
      set bounds of container window to {200, 100, 800, 500}
      set viewOptions to the icon view options of container window
      set arrangement of viewOptions to not arranged
      set icon size of viewOptions to 128
      delay 1
      try
        set position of item "$APP_NAME.app" of container window to {150, 200}
      end try
      try
        set position of item "Applications" of container window to {450, 200}
      end try
      update without registering applications
      delay 2
      close
    end tell
  end tell
end timeout
EOF

# Sync và unmount (retry vì Finder đôi khi giữ lock vài giây)
sync
for _ in 1 2 3 4 5; do
  hdiutil detach "$MOUNT_DIR" -force >/dev/null 2>&1 && break
  sleep 1
done

# 3) Convert sang compressed read-only DMG
hdiutil convert "dist/temp.dmg" \
  -format UDZO -imagekey zlib-level=9 \
  -o "dist/$DMG_NAME"

# Cleanup
rm -f "dist/temp.dmg"
rm -rf "$STAGING"

echo ""
echo "Xong. File .dmg: dist/$DMG_NAME"
echo "Mở DMG để kéo $APP_NAME vào Applications."
echo ""
