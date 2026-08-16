#!/usr/bin/env python3
"""Slice and ground-anchor the Ronin bow-down (tap-reaction) sprite sheet.

Input: apps/mobile/assets/ronin/journey/tap-reaction/source/ronin-tap-reaction-sheet-raw.png
— already a real-alpha RGBA sheet (not green-screen), with 6 side-profile
bow-down poses left to right, boy+cat as one connected silhouette per pose.

Output: apps/mobile/assets/ronin/journey/tap-reaction/ronin-tap-01.png ..
ronin-tap-06.png, ground-anchored (each frame keeps its true relative
vertical position from the original sheet, where every pose already shares
one baseline) so a shorter silhouette (e.g. bent forward mid-bow) doesn't
get padded underneath and visually float upward when frame-swapped against
a taller neighboring pose — see build-ronin-jump-frames.py for the same fix
applied to the jump sheet, where this was first diagnosed.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

MOBILE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = MOBILE_ROOT / "assets" / "ronin" / "journey" / "tap-reaction" / "source" / "ronin-tap-reaction-sheet-raw.png"
OUTPUT_DIR = MOBILE_ROOT / "assets" / "ronin" / "journey" / "tap-reaction"
MIN_FRAME_COUNT = 2
MAX_FRAME_COUNT = 12
MIN_COMPONENT_AREA_PX = 500
PAD_PX = 24
ALPHA_THRESHOLD = 20


def load_source() -> np.ndarray:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(
            f"Raw sprite sheet not found at {SOURCE_PATH}. Save the generated sheet there before running this script."
        )
    return np.array(Image.open(SOURCE_PATH).convert("RGBA"))


def find_character_boxes(rgba: np.ndarray) -> tuple[np.ndarray, list[tuple[tuple[slice, slice], int]]]:
    alpha = rgba[..., 3]
    mask = alpha > ALPHA_THRESHOLD
    labeled, _count = label(mask)
    boxes = find_objects(labeled)

    kept = []
    for index, box in enumerate(boxes, start=1):
        area = int((mask[box] & (labeled[box] == index)).sum())
        if area >= MIN_COMPONENT_AREA_PX:
            kept.append((box, index))
    kept.sort(key=lambda item: item[0][1].start)

    if not (MIN_FRAME_COUNT <= len(kept) <= MAX_FRAME_COUNT):
        raise ValueError(
            f"Found {len(kept)} pose components in the sheet, expected between "
            f"{MIN_FRAME_COUNT} and {MAX_FRAME_COUNT}. Check the source sheet for "
            "touching/merged silhouettes or stray specks before re-running."
        )
    return labeled, kept


def build_frame(
    rgba: np.ndarray,
    labeled: np.ndarray,
    label_id: int,
    box: tuple[slice, slice],
    canvas_size: int,
    left_pad: int,
    right_pad: int,
    paste_y: int,
) -> Image.Image:
    row_slice, col_slice = box
    top = max(row_slice.start - PAD_PX, 0)
    bottom = min(row_slice.stop + PAD_PX, rgba.shape[0])
    left = max(col_slice.start - left_pad, 0)
    right = min(col_slice.stop + right_pad, rgba.shape[1])

    crop = rgba[top:bottom, left:right].copy()
    # Two poses' bounding boxes can overlap in x (they're pixel-disjoint but
    # not x-range-disjoint — one pose's cat tail can sit at the same column
    # range as the next pose's body, just on different rows). A plain
    # rectangular crop would then bleed in the neighbor's pixels, so also
    # gate on this component's own label, not just alpha.
    own_component = labeled[top:bottom, left:right] == label_id
    crop[~own_component] = 0
    frame = Image.fromarray(crop, mode="RGBA")

    foreground_cols = np.where(own_component.any(axis=0))[0]
    center_x = int((foreground_cols[0] + foreground_cols[-1]) / 2) if len(foreground_cols) else frame.width // 2

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    paste_x = canvas_size // 2 - center_x
    canvas.paste(frame, (paste_x, paste_y), frame)
    return canvas


def main() -> None:
    rgba = load_source()
    labeled, items = find_character_boxes(rgba)
    boxes = [box for box, _label_id in items]
    label_ids = [label_id for _box, label_id in items]

    pads = []
    for i, (_row_slice, col_slice) in enumerate(boxes):
        prev_gap = col_slice.start - boxes[i - 1][1].stop if i > 0 else PAD_PX * 2
        next_gap = boxes[i + 1][1].start - col_slice.stop if i < len(boxes) - 1 else PAD_PX * 2
        left_pad = max(min(PAD_PX, prev_gap // 2), 0)
        right_pad = max(min(PAD_PX, next_gap // 2), 0)
        pads.append((left_pad, right_pad))

    padded_tops = [max(row_slice.start - PAD_PX, 0) for row_slice, _ in boxes]
    padded_bottoms = [min(row_slice.stop + PAD_PX, rgba.shape[0]) for row_slice, _ in boxes]
    global_top = min(padded_tops)
    global_bottom = max(padded_bottoms)
    canvas_height = global_bottom - global_top

    canvas_width = 0
    for (_row_slice, col_slice), (left_pad, right_pad) in zip(boxes, pads):
        width = (col_slice.stop - col_slice.start) + left_pad + right_pad
        canvas_width = max(canvas_width, width)
    canvas_size = max(canvas_width, canvas_height)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, (box, label_id, (left_pad, right_pad), top) in enumerate(
        zip(boxes, label_ids, pads, padded_tops), start=1
    ):
        paste_y = (top - global_top) + (canvas_size - canvas_height) // 2
        frame = build_frame(rgba, labeled, label_id, box, canvas_size, left_pad, right_pad, paste_y)
        out_path = OUTPUT_DIR / f"ronin-tap-{index:02d}.png"
        frame.save(out_path)
        print(f"wrote {out_path} ({frame.width}x{frame.height})")

    print(f"TOTAL FRAMES: {len(boxes)}")


if __name__ == "__main__":
    main()
