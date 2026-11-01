#!/usr/bin/env python3
# icon builder: favicon pngs, ico, app icons
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BG = (10, 12, 16, 255)  # #0A0C10
LINE = (255, 255, 255, 255)
POINTS = [(14, 44), (24, 30), (32, 36), (44, 18), (50, 24)]  # 64 grid, same as svg
RADIUS = 14
STROKE = 5
SS = 8  # supersample factor


def render(size, stroke=STROKE, rounded=True):
    big = size * SS
    k = big / 64
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # tile
    if rounded:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=RADIUS * k, fill=BG)
    else:
        d.rectangle([0, 0, big - 1, big - 1], fill=BG)
    # chart line
    pts = [(x * k, y * k) for x, y in POINTS]
    w = stroke * k
    d.line(pts, fill=LINE, width=round(w))
    # round caps + joins
    r = w / 2
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=LINE)
    # box at tiny sizes, no ringing
    resample = Image.BOX if size <= 32 else Image.LANCZOS
    return img.resize((size, size), resample)


def main():
    out = {
        "favicon-48.png": render(48),
        "favicon-96.png": render(96),
        "favicon-192.png": render(192),
        "icon-192.png": render(192),
        "icon-512.png": render(512),
    }
    for name, img in out.items():
        img.save(ROOT / name, optimize=True)

    # apple touch, opaque, ios rounds it
    render(180, rounded=False).convert("RGB").save(ROOT / "apple-touch-icon.png", optimize=True)

    # ico 16/32/48, thicker line at 16
    ico = [render(16, stroke=7), render(32, stroke=5.5), render(48)]
    ico[2].save(ROOT / "favicon.ico", format="ICO", sizes=[(48, 48), (32, 32), (16, 16)],
                append_images=ico[:2])
    print("icons written")


if __name__ == "__main__":
    main()
