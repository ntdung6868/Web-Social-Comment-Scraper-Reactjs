"""Generate CookieForge app icon (1024x1024 PNG → .icns + .ico).

Design:
  - Squircle background (Apple Big Sur+ style) with vertical gradient
    from deep navy (#0f172a) to bright cyan (#38bdf8) — matches app theme.
  - White cookie disc with subtle inner shadow.
  - 5 chocolate chips (asymmetric for organic look).
  - Soft outer drop shadow on the cookie for depth.
"""
from PIL import Image, ImageDraw, ImageFilter
import sys
from pathlib import Path

SIZE = 1024
OUT_DIR = Path(__file__).parent
PNG_PATH = OUT_DIR / "icon_1024.png"


def lerp(a, b, t):
    return int(a + (b - a) * t)


def make_squircle_mask(size, radius_ratio=0.224):
    """Apple-style rounded square mask. iOS/macOS Big Sur uses ~22.4% corner radius."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), r, fill=255)
    return mask


def make_gradient_background(size):
    """Vertical gradient: navy top → cyan bottom."""
    img = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(img)
    # #0f172a (15, 23, 42) → #38bdf8 (56, 189, 248)
    for y in range(size):
        t = y / size
        # ease-in for richer top, brighter bottom
        t = t * t * (3 - 2 * t)  # smoothstep
        r = lerp(15, 56, t)
        g = lerp(23, 189, t)
        b = lerp(42, 248, t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    return img


def draw_cookie(img, cx, cy, radius):
    """Cookie disc + chips. Drawn directly onto the background img."""
    draw = ImageDraw.Draw(img)
    # Drop shadow — render shadow on a separate layer then blur
    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    shadow_offset = int(radius * 0.04)
    sd.ellipse(
        (cx - radius + shadow_offset, cy - radius + shadow_offset * 2,
         cx + radius + shadow_offset, cy + radius + shadow_offset * 2),
        fill=(0, 0, 0, 100),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=int(radius * 0.06)))
    img.alpha_composite(shadow_layer)

    # Cookie body: warm wheat color with subtle gradient (top lighter)
    cookie_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    cl = ImageDraw.Draw(cookie_layer)
    cl.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(248, 224, 174, 255))
    img.alpha_composite(cookie_layer)

    # Inner highlight (top-left) — gives 3D feel
    highlight = Image.new("RGBA", img.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    inset = int(radius * 0.18)
    hd.ellipse(
        (cx - radius + inset, cy - radius + inset,
         cx + radius - int(radius * 0.55), cy + radius - int(radius * 0.55)),
        fill=(255, 255, 255, 35),
    )
    highlight = highlight.filter(ImageFilter.GaussianBlur(radius=int(radius * 0.08)))
    img.alpha_composite(highlight)

    # Chocolate chips: asymmetric placement, varying sizes for organic feel
    # Coordinates relative to cookie center; r = chip radius as fraction of cookie radius
    chips = [
        (-0.45, -0.35, 0.13),
        ( 0.40, -0.45, 0.11),
        (-0.30,  0.30, 0.14),
        ( 0.45,  0.20, 0.10),
        ( 0.05,  0.55, 0.09),
    ]
    chip_color_dark = (62, 32, 12, 255)
    chip_color_light = (95, 55, 25, 255)
    for dx, dy, rr in chips:
        ccx = cx + dx * radius
        ccy = cy + dy * radius
        cr = rr * radius
        # Outer dark
        draw.ellipse((ccx - cr, ccy - cr, ccx + cr, ccy + cr), fill=chip_color_dark)
        # Inner highlight on top-left of chip
        hr = cr * 0.55
        draw.ellipse(
            (ccx - cr * 0.4, ccy - cr * 0.5, ccx - cr * 0.4 + hr, ccy - cr * 0.5 + hr),
            fill=chip_color_light,
        )


def main():
    print(f"Generating {SIZE}x{SIZE} icon...")
    bg = make_gradient_background(SIZE)
    mask = make_squircle_mask(SIZE)

    # Apply rounded-square mask to gradient
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0), mask)

    # Cookie centered, 56% of canvas
    cookie_radius = int(SIZE * 0.28)
    draw_cookie(canvas, SIZE // 2, SIZE // 2, cookie_radius)

    canvas.save(PNG_PATH, "PNG")
    print(f"✓ Saved {PNG_PATH}")

    # Also save .ico (multi-size, for Windows)
    ico_path = OUT_DIR / "icon.ico"
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    canvas.save(ico_path, format="ICO", sizes=sizes)
    print(f"✓ Saved {ico_path}")

    print("\nNext: run `make_icns.sh` to produce icon.icns from this PNG.")


if __name__ == "__main__":
    main()
