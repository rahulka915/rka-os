#!/usr/bin/env python3
"""Generate a Ronin kasa (conical straw hat) PNG as a drop-in replacement for the
marketplace rig's `高帽` top-hat asset.

Pure stdlib — no Pillow. Renders supersampled then box-downsamples for antialiasing,
and writes RGBA PNG by hand (zlib + struct).

Output MUST match the original asset's pixel dimensions exactly (500x308) so Rive's
Replace swaps pixels without disturbing mesh/bones/weights.
"""

import math
import struct
import zlib

W, H = 500, 308
SS = 3  # supersample factor
SW, SH = W * SS, H * SS

# Flat cel palette, warm straw + Ronin red accent. RGBA.
OUTLINE = (74, 58, 40, 255)
STRAW_LIGHT = (217, 190, 134, 255)
STRAW_MID = (198, 168, 110, 255)
STRAW_SHADOW = (168, 138, 88, 255)
CORD = (196, 69, 69, 255)
TRANSPARENT = (0, 0, 0, 0)

# Geometry (in supersampled space)
APEX = (250 * SS, 26 * SS)
BRIM_CY = 236 * SS
BRIM_RX = 236 * SS
BRIM_RY = 56 * SS
BRIM_CX = 250 * SS
OUTLINE_W = 3.0 * SS


def in_ellipse(x, y, cx, cy, rx, ry):
    dx = (x - cx) / rx
    dy = (y - cy) / ry
    return dx * dx + dy * dy <= 1.0


def in_triangle(px, py, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

    d1 = sign((px, py), a, b)
    d2 = sign((px, py), b, c)
    d3 = sign((px, py), c, a)
    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (has_neg and has_pos)


BRIM_L = (BRIM_CX - BRIM_RX, BRIM_CY)
BRIM_R = (BRIM_CX + BRIM_RX, BRIM_CY)


def shape_at(x, y):
    """Return the RGBA colour for a supersampled point, or TRANSPARENT."""
    inside_brim = in_ellipse(x, y, BRIM_CX, BRIM_CY, BRIM_RX, BRIM_RY)
    inside_cone = in_triangle(x, y, APEX, BRIM_L, BRIM_R)
    inside = inside_brim or inside_cone
    if not inside:
        return TRANSPARENT

    # Outline: near the silhouette edge.
    shrink = 1.0 - (OUTLINE_W / BRIM_RY) * 0.55
    inner_brim = in_ellipse(x, y, BRIM_CX, BRIM_CY, BRIM_RX - OUTLINE_W, BRIM_RY - OUTLINE_W * 0.6)
    inner_apex = (APEX[0], APEX[1] + OUTLINE_W * 1.9)
    inner_l = (BRIM_L[0] + OUTLINE_W * 1.5, BRIM_L[1] - OUTLINE_W * 0.3)
    inner_r = (BRIM_R[0] - OUTLINE_W * 1.5, BRIM_R[1] - OUTLINE_W * 0.3)
    inner_cone = in_triangle(x, y, inner_apex, inner_l, inner_r)
    if not (inner_brim or inner_cone):
        return OUTLINE

    # Cord band: a red wrap just above the brim line on the cone.
    t = (y - APEX[1]) / float(BRIM_CY - APEX[1]) if BRIM_CY != APEX[1] else 0.0
    if 0.70 <= t <= 0.79 and inside_cone and not in_ellipse(
        x, y, BRIM_CX, BRIM_CY, BRIM_RX - OUTLINE_W, BRIM_RY - OUTLINE_W * 0.6
    ):
        return CORD

    # Straw ribs radiating from the apex — flat darker tone, no gradient (cel style).
    ang = math.atan2(y - APEX[1], x - APEX[0])
    rib = math.sin(ang * 26.0)
    base = STRAW_LIGHT

    # Cel shadow follows the cone's radial form (light from upper-left), so the
    # tone breaks run along the slope rather than as vertical slabs.
    norm = ang / math.pi  # 0 = hard right, 1 = hard left
    if norm < 0.30:
        base = STRAW_SHADOW
    elif norm < 0.46:
        base = STRAW_MID
    # Underside of the brim reads darker.
    if inside_brim and y > BRIM_CY + BRIM_RY * 0.10:
        base = STRAW_SHADOW

    if rib > 0.72:
        if base is STRAW_LIGHT:
            return STRAW_MID
        if base is STRAW_MID:
            return STRAW_SHADOW
        return (148, 120, 74, 255)
    return base


def render():
    # Accumulate supersampled rows, downsampling as we go to bound memory.
    out = bytearray()
    inv = 1.0 / (SS * SS)
    for py in range(H):
        row = bytearray()
        row.append(0)  # PNG filter type 0 for this scanline
        # Pre-render the SS sub-rows for this output row.
        subrows = []
        for sy in range(py * SS, (py + 1) * SS):
            subrows.append([shape_at(sx, sy) for sx in range(SW)])
        for px in range(W):
            r = g = b = a = 0
            for sr in subrows:
                for sx in range(px * SS, (px + 1) * SS):
                    c = sr[sx]
                    # Premultiply so edge pixels blend correctly.
                    af = c[3]
                    r += c[0] * af
                    g += c[1] * af
                    b += c[2] * af
                    a += af
            if a == 0:
                row.extend((0, 0, 0, 0))
            else:
                row.extend((
                    min(255, int(r / a + 0.5)),
                    min(255, int(g / a + 0.5)),
                    min(255, int(b / a + 0.5)),
                    min(255, int(a * inv + 0.5)),
                ))
        out.extend(row)
    return bytes(out)


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, raw):
    ihdr = struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    import sys

    dest = sys.argv[1] if len(sys.argv) > 1 else "ronin-kasa-500x308.png"
    write_png(dest, render())
    print("wrote", dest, W, "x", H)
