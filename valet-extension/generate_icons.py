#!/usr/bin/env python3
"""
generate_icons.py — creates icon16.png, icon48.png, icon128.png
Rounded dark background with a clean white folder + inward arrow.
Requires Pillow (pip install pillow).
"""

import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")

BG       = (15,  15,  20,  255)   # near-black bg
FOLDER   = (255, 255, 255, 220)   # white folder
ARROW    = (80,  160, 255, 255)   # blue accent arrow


def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + radius * 2, y0 + radius * 2], fill=fill)
    draw.ellipse([x1 - radius * 2, y0, x1, y0 + radius * 2], fill=fill)
    draw.ellipse([x0, y1 - radius * 2, x0 + radius * 2, y1], fill=fill)
    draw.ellipse([x1 - radius * 2, y1 - radius * 2, x1, y1], fill=fill)


def make_icon(size: int) -> Image.Image:
    scale = 4  # draw at 4x for anti-aliasing
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background rounded square
    r = s // 5
    rounded_rect(d, [0, 0, s, s], r, BG)

    pad   = s // 7
    fw    = s - pad * 2          # folder width
    fh    = int(fw * 0.72)       # folder height
    fx    = pad
    fy    = (s - fh) // 2 + s // 20  # slightly below center

    # Folder tab
    tab_w = int(fw * 0.42)
    tab_h = int(fh * 0.18)
    tab_r = int(tab_h * 0.6)
    rounded_rect(d, [fx, fy - tab_h, fx + tab_w, fy + tab_r], tab_r, FOLDER)

    # Folder body
    body_r = max(2, s // 28)
    rounded_rect(d, [fx, fy, fx + fw, fy + fh], body_r, FOLDER)

    # Arrow: downward-pointing chevron centred in body
    if size >= 32:
        cx    = fx + fw // 2
        cy    = fy + int(fh * 0.56)
        aw    = int(fw * 0.30)
        ah    = int(fh * 0.28)
        sw    = max(2, s // 26)

        # Stem
        d.rectangle([cx - sw // 2, cy - ah, cx + sw // 2, cy + ah // 3], fill=ARROW)
        # Arrow head (two diagonal lines)
        for dx, sign in [(-1, 1), (1, -1)]:
            d.line(
                [cx + dx * aw // 2, cy - ah // 5,
                 cx,                cy + ah * 2 // 3],
                fill=ARROW, width=sw
            )

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for sz in (16, 48, 128):
        path = os.path.join(OUT_DIR, f"icon{sz}.png")
        make_icon(sz).save(path)
        print(f"  created {path}")
    print("Icons generated.")
