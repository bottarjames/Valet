#!/usr/bin/env python3
"""
generate_icons.py — creates icon16.png, icon48.png, icon128.png
Transparent background. Vivid gradient folder with white arrow.
Requires Pillow.
"""

import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")


def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def make_icon(size: int) -> Image.Image:
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d   = ImageDraw.Draw(img)

    pad  = int(s * 0.06)
    fw   = s - pad * 2
    fh   = int(fw * 0.74)
    fx   = pad
    fy   = (s - fh) // 2 + int(s * 0.06)

    # ── Folder tab ──────────────────────────────────────────────────────────
    tab_w = int(fw * 0.44)
    tab_h = int(fh * 0.20)
    tab_r = int(tab_h * 0.7)

    # Gradient: top of tab = light blue, body bottom = indigo
    TOP    = (100, 200, 255, 255)
    BOTTOM = (80,  90,  240, 255)

    tab_img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    td = ImageDraw.Draw(tab_img)

    # Draw tab shape
    td.rounded_rectangle(
        [fx, fy - tab_h, fx + tab_w, fy + tab_r],
        radius=tab_r, fill=(255, 255, 255, 255)
    )

    # ── Folder body ─────────────────────────────────────────────────────────
    body_r = max(3, s // 22)
    td.rounded_rectangle(
        [fx, fy, fx + fw, fy + fh],
        radius=body_r, fill=(255, 255, 255, 255)
    )

    # Apply vertical gradient by masking with gradient pixels
    folder_mask = tab_img.split()[3]  # alpha = shape mask

    # Build gradient layer
    grad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    for row in range(s):
        t = max(0.0, min(1.0, (row - (fy - tab_h)) / (fh + tab_h)))
        color = lerp_color(TOP, BOTTOM, t)
        grad.paste(Image.new("RGBA", (s, 1), color), (0, row))

    grad.putalpha(folder_mask)
    img = Image.alpha_composite(img, grad)

    # ── Arrow ────────────────────────────────────────────────────────────────
    if size >= 24:
        d2  = ImageDraw.Draw(img)
        cx  = fx + fw // 2
        cy  = fy + int(fh * 0.56)
        aw  = int(fw * 0.22)
        ah  = int(fh * 0.34)
        sw  = max(2, s // 20)
        col = (255, 255, 255, 230)

        # Stem
        d2.rounded_rectangle(
            [cx - sw // 2, cy - ah // 2, cx + sw // 2, cy + ah // 4],
            radius=sw // 2, fill=col
        )
        # Arrowhead: solid filled triangle
        tip_x, tip_y = cx, cy + ah // 2
        d2.polygon(
            [tip_x - aw, cy - ah // 8,
             tip_x + aw, cy - ah // 8,
             tip_x,      tip_y],
            fill=col
        )

    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for sz in (16, 48, 128):
        path = os.path.join(OUT_DIR, f"icon{sz}.png")
        make_icon(sz).save(path)
        print(f"  created {path}")
    print("Icons generated.")
