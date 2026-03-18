#!/usr/bin/env python3
"""
generate_icons.py — creates icon16.png, icon48.png, icon128.png
using only stdlib (struct + zlib). No Pillow required.
Draws a simple folder shape in Valet blue.
"""

import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")


def make_folder_png(size: int) -> bytes:
    """Return PNG bytes for a folder icon at the given square size."""
    m   = max(1, size // 10)          # outer margin
    th  = size // 4                   # tab height
    tw  = size * 11 // 20             # tab width
    bx0 = m                           # body left
    bx1 = size - m                    # body right
    by0 = th                          # body top (flush with tab bottom)
    by1 = size - m                    # body bottom

    BODY = (70,  130, 210, 255)       # blue
    TAB  = (100, 165, 235, 255)       # lighter blue tab
    TRAD = max(2, size // 16)         # tab top-right corner rounding radius

    raw = bytearray()
    for y in range(size):
        raw.append(0)                 # PNG filter byte: None
        for x in range(size):
            in_body = bx0 <= x < bx1 and by0 <= y < by1
            in_tab  = m <= x < tw and m <= y < th

            # Round the tab's top-right corner
            if in_tab and x >= tw - TRAD and y <= m + TRAD:
                dx = x - (tw - TRAD - 1)
                dy = (m + TRAD) - y
                in_tab = dx * dx + dy * dy <= TRAD * TRAD

            if in_tab:
                raw += bytes(TAB)
            elif in_body:
                raw += bytes(BODY)
            else:
                raw += bytes([0, 0, 0, 0])   # transparent

    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag: bytes, data: bytes) -> bytes:
        payload = tag + data
        return (struct.pack(">I", len(data))
                + payload
                + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # RGBA

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for sz in (16, 48, 128):
        path = os.path.join(OUT_DIR, f"icon{sz}.png")
        with open(path, "wb") as f:
            f.write(make_folder_png(sz))
        print(f"  created {path}")
    print("Icons generated.")
