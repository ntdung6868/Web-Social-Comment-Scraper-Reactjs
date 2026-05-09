#!/bin/bash
# Convert icon_1024.png → icon.icns (macOS native multi-resolution format)
set -e
cd "$(dirname "$0")"

SRC="icon_1024.png"
ICONSET="icon.iconset"
OUT="icon.icns"

if [ ! -f "$SRC" ]; then
  echo "Run \`python3 make_icon.py\` first to generate $SRC"
  exit 1
fi

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# macOS expects these specific size + name combinations
sips -z 16   16   "$SRC" --out "$ICONSET/icon_16x16.png"     >/dev/null
sips -z 32   32   "$SRC" --out "$ICONSET/icon_16x16@2x.png"  >/dev/null
sips -z 32   32   "$SRC" --out "$ICONSET/icon_32x32.png"     >/dev/null
sips -z 64   64   "$SRC" --out "$ICONSET/icon_32x32@2x.png"  >/dev/null
sips -z 128  128  "$SRC" --out "$ICONSET/icon_128x128.png"   >/dev/null
sips -z 256  256  "$SRC" --out "$ICONSET/icon_128x128@2x.png">/dev/null
sips -z 256  256  "$SRC" --out "$ICONSET/icon_256x256.png"   >/dev/null
sips -z 512  512  "$SRC" --out "$ICONSET/icon_256x256@2x.png">/dev/null
sips -z 512  512  "$SRC" --out "$ICONSET/icon_512x512.png"   >/dev/null
cp "$SRC" "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o "$OUT"
rm -rf "$ICONSET"

echo "✓ Saved $OUT"
ls -lh "$OUT"
