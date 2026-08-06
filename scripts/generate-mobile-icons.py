#!/usr/bin/env python3
"""Generate all mobile icon/splash assets from the source chameleon image.

Produces:
  mobile/assets/images/icon.png            (1024x1024, app icon)
  mobile/assets/images/adaptive-icon.png   (1024x1024, Android adaptive foreground)
  mobile/assets/images/splash.png          (2048x2048 dark-bg canvas)
  mobile/assets/images/notification-icon.png (96x96 white-on-transparent silhouette)
  mobile/assets/images/feature-graphic.png (1024x500 Play Store feature graphic)
"""
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand" / "mascot" / "chameleon-glow.png"
OUT = ROOT / "mobile" / "assets" / "images"
OUT.mkdir(parents=True, exist_ok=True)

BG = (11, 18, 21, 255)  # #0b1215
CHAMELEON_GREEN = (34, 197, 94, 255)

src = Image.open(SRC).convert("RGBA")
print(f"Source: {src.size}")


def fit_on_canvas(size: int, safe_ratio: float = 0.72) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    target = int(size * safe_ratio)
    sw, sh = src.size
    scale = min(target / sw, target / sh)
    new = src.resize((max(1, int(sw * scale)), max(1, int(sh * scale))), Image.LANCZOS)
    x = (size - new.width) // 2
    y = (size - new.height) // 2
    canvas.paste(new, (x, y), new)
    return canvas


def make_icon():
    icon = fit_on_canvas(1024, safe_ratio=0.78)
    icon.save(OUT / "icon.png", "PNG", optimize=True)
    print("wrote icon.png")


def make_adaptive():
    # Android adaptive icon: foreground must live inside a 66% safe zone of a
    # 1024x1024 image, with transparent background around it. The system draws
    # its own background layer.
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    target = int(1024 * 0.60)
    sw, sh = src.size
    scale = min(target / sw, target / sh)
    new = src.resize((max(1, int(sw * scale)), max(1, int(sh * scale))), Image.LANCZOS)
    canvas.paste(new, ((1024 - new.width) // 2, (1024 - new.height) // 2), new)
    canvas.save(OUT / "adaptive-icon.png", "PNG", optimize=True)
    print("wrote adaptive-icon.png")


def make_splash():
    splash = fit_on_canvas(2048, safe_ratio=0.55)
    splash.save(OUT / "splash.png", "PNG", optimize=True)
    print("wrote splash.png")


def make_notification_icon():
    # Android notification icon must be a white silhouette on transparent.
    # Take the alpha channel of the source and paint it white.
    size = 96
    fg = src.copy()
    fg.thumbnail((size, size), Image.LANCZOS)
    alpha = fg.split()[3]
    white = Image.new("RGBA", fg.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(white, ((size - white.width) // 2, (size - white.height) // 2), white)
    canvas.save(OUT / "notification-icon.png", "PNG", optimize=True)
    print("wrote notification-icon.png")


def make_feature_graphic():
    # Play Store feature graphic: 1024x500. Chameleon on the right, text zone on left.
    w, h = 1024, 500
    canvas = Image.new("RGBA", (w, h), BG)
    target = int(h * 0.85)
    sw, sh = src.size
    scale = min(target / sw, target / sh)
    new = src.resize((max(1, int(sw * scale)), max(1, int(sh * scale))), Image.LANCZOS)
    x = w - new.width - 40
    y = (h - new.height) // 2
    canvas.paste(new, (x, y), new)
    canvas.save(OUT / "feature-graphic.png", "PNG", optimize=True)
    print("wrote feature-graphic.png")


if __name__ == "__main__":
    make_icon()
    make_adaptive()
    make_splash()
    make_notification_icon()
    make_feature_graphic()
    print("done")
