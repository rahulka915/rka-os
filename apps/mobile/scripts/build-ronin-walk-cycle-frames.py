#!/usr/bin/env python3
"""Slice, align, and key the 8-frame Ronin walk-cycle sprite sheet into individual frame PNGs.

Input: a single green-screen (#00FF00) sheet containing 8 side-profile walk-cycle poses,
left to right, generated per docs/superpowers/specs/2026-08-15-simplified-walking-ronin-avatar-design.md.

Output: apps/mobile/assets/ronin/journey/walk-cycle/ronin-walk-01.png .. ronin-walk-08.png,
each on an identical-size transparent canvas, head-top-anchored so frame-swapping doesn't jitter.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

MOBILE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = MOBILE_ROOT / "assets" / "ronin" / "journey" / "walk-cycle" / "source" / "ronin-walk-cycle-sheet-raw.png"
OUTPUT_DIR = MOBILE_ROOT / "assets" / "ronin" / "journey" / "walk-cycle"
FRAME_COUNT = 8
PAD_PX = 24
GREEN_KEY = np.array([0, 255, 0], dtype=np.float32)
GREEN_TOLERANCE = 90.0  # euclidean RGB distance under which a pixel counts as background
HEAD_TOP_MARGIN_PX = 20  # distance from canvas top to each frame's topmost foreground pixel


def load_source() -> np.ndarray:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(
            f"Raw sprite sheet not found at {SOURCE_PATH}. Save the generated sheet there before running this script."
        )
    image = Image.open(SOURCE_PATH).convert("RGB")
    return np.array(image)


def foreground_mask(rgb: np.ndarray) -> np.ndarray:
    distance = np.linalg.norm(rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    return distance > GREEN_TOLERANCE


def find_character_boxes(mask: np.ndarray) -> list[tuple[slice, slice]]:
    labeled, count = label(mask)
    if count != FRAME_COUNT:
        raise ValueError(
            f"Expected {FRAME_COUNT} separate characters in the sheet, found {count}. "
            "Check the source sheet for touching/merged silhouettes before re-running."
        )
    boxes = find_objects(labeled)
    # Sort left-to-right by the box's horizontal start, matching walk-cycle pose order.
    return sorted(boxes, key=lambda box: box[1].start)


def despill(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    # Standard green-spill fix: where a pixel is semi-transparent (edge of the
    # key), pull its green channel down toward the min of red/blue so no green
    # fringe survives compositing over a non-green background.
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    spill_strength = np.clip(1.0 - alpha, 0.0, 1.0)
    corrected_g = np.where(
        g > np.minimum(r, b),
        np.minimum(r, b) + (g - np.minimum(r, b)) * (1.0 - spill_strength),
        g,
    )
    return np.stack([r, corrected_g, b], axis=-1)


def build_frame(rgb: np.ndarray, mask: np.ndarray, box: tuple[slice, slice], canvas_size: int) -> Image.Image:
    row_slice, col_slice = box
    top = max(row_slice.start - PAD_PX, 0)
    bottom = min(row_slice.stop + PAD_PX, rgb.shape[0])
    left = max(col_slice.start - PAD_PX, 0)
    right = min(col_slice.stop + PAD_PX, rgb.shape[1])

    crop_rgb = rgb[top:bottom, left:right]
    crop_mask = mask[top:bottom, left:right]

    distance = np.linalg.norm(crop_rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    alpha = np.clip((distance - GREEN_TOLERANCE * 0.5) / (GREEN_TOLERANCE * 0.5), 0.0, 1.0)
    alpha[~crop_mask] = 0.0
    corrected_rgb = despill(crop_rgb, alpha)

    rgba = np.dstack([corrected_rgb, alpha * 255.0]).astype(np.uint8)
    frame = Image.fromarray(rgba, mode="RGBA")

    # Head-top anchor: topmost foreground row within this crop.
    foreground_rows = np.where(crop_mask.any(axis=1))[0]
    head_top_y = int(foreground_rows[0]) if len(foreground_rows) else 0
    foreground_cols = np.where(crop_mask.any(axis=0))[0]
    center_x = int((foreground_cols[0] + foreground_cols[-1]) / 2) if len(foreground_cols) else frame.width // 2

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    paste_x = canvas_size // 2 - center_x
    paste_y = HEAD_TOP_MARGIN_PX - head_top_y
    canvas.paste(frame, (paste_x, paste_y), frame)
    return canvas


def main() -> None:
    rgb = load_source()
    mask = foreground_mask(rgb)
    boxes = find_character_boxes(mask)

    # Canvas must fit the largest cropped frame plus padding, shared by all 8
    # frames so swapping never changes the Image element's own size.
    max_dim = 0
    for row_slice, col_slice in boxes:
        height = (row_slice.stop - row_slice.start) + PAD_PX * 2
        width = (col_slice.stop - col_slice.start) + PAD_PX * 2
        max_dim = max(max_dim, height, width)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, box in enumerate(boxes, start=1):
        frame = build_frame(rgb, mask, box, max_dim)
        out_path = OUTPUT_DIR / f"ronin-walk-{index:02d}.png"
        frame.save(out_path)
        print(f"wrote {out_path} ({frame.width}x{frame.height})")


if __name__ == "__main__":
    main()
