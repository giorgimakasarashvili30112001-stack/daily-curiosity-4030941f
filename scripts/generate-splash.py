#!/usr/bin/env python3
"""
generate-splash.py
------------------
Generates the Android launch/splash assets from public/icon-512.png:
  - res/drawable-nodpi/splash_icon.png   (icon for the Android 12+ system splash)
  - res/drawable*/splash.png             (full-screen fallback background, all densities)
The glyph is extracted from the icon (dark background removed) and tinted with the
app's primary color, on the app's dark background color (src/styles.css).

Usage: python3 scripts/generate-splash.py   (needs Pillow)
"""
from PIL import Image
import os

BG = (0x09, 0x0D, 0x15)        # --background: oklch(0.16 0.018 264)
AMBER = (0xF4, 0xA9, 0x3C)     # --primary:    oklch(0.79 0.148 72)
RES = "android/app/src/main/res"

# --- 1. Extract the glowing glyph as a transparent, amber-tinted image -------------
src = Image.open("public/icon-512.png").convert("RGB")
w, h = src.size
glyph = Image.new("RGBA", (w, h))
sp, gp = src.load(), glyph.load()
for y in range(h):
    for x in range(w):
        v = max(sp[x, y])                      # brightness 0..255
        a = max(0.0, (v - 70) / (255 - 70))    # drop the near-black background and the dim glow
        gp[x, y] = (*AMBER, int(min(1.0, a ** 0.85) * 255))
bbox = glyph.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
glyph = glyph.crop(bbox)

def place(canvas_size, glyph_height, bg=None):
    """Centers the glyph (scaled to glyph_height px tall) on a canvas."""
    cw, ch = canvas_size
    g = glyph.resize((round(glyph.width * glyph_height / glyph.height), glyph_height), Image.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (*bg, 255) if bg else (0, 0, 0, 0))
    canvas.alpha_composite(g, ((cw - g.width) // 2, (ch - g.height) // 2))
    return canvas

# --- 2. Android 12+ system splash icon: 288dp canvas at xxxhdpi (1152px). The icon must
#        fit inside a circle 2/3 of the canvas (768px): glyph diagonal stays well within.
os.makedirs(f"{RES}/drawable-nodpi", exist_ok=True)
place((1152, 1152), 520).save(f"{RES}/drawable-nodpi/splash_icon.png", optimize=True)

# --- 3. Full-screen fallback backgrounds (same sizes Capacitor's template uses) ----
sizes = {
    "drawable": (480, 320),
    "drawable-port-mdpi": (320, 480), "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280), "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320), "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720), "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
}
for folder, size in sizes.items():
    path = f"{RES}/{folder}/splash.png"
    place(size, round(min(size) * 0.30), bg=BG).convert("RGB").save(path, optimize=True)
    print("wrote", path, size)
print("wrote", f"{RES}/drawable-nodpi/splash_icon.png")
