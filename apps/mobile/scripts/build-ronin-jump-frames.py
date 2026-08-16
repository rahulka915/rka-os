#!/usr/bin/env python3
"""Slice, align, and key the Ronin jump sprite sheet into individual frame PNGs.

Input: a single green-screen (#00FF00) sheet containing side-profile jump-pose
frames, left to right, generated per
docs/superpowers/specs/2026-08-16-ronin-jump-bow-buttons-design.md.

Output: apps/mobile/assets/ronin/journey/jump/ronin-jump-01.png ..
ronin-jump-0N.png (N auto-detected from the sheet), each on an identical-size
transparent canvas. Frames are GROUND-anchored, not head-anchored: each
frame keeps its true relative vertical position from the original sheet
(where every pose already shares one baseline), so a pose with a shorter
silhouette (e.g. legs tucked mid-air, or bent forward) doesn't get padded
underneath and visually float upward when frame-swapped against a taller
neighboring pose — that floating read as an unwanted "hop" during playback.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

MOBILE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = MOBILE_ROOT / "assets" / "ronin" / "journey" / "jump" / "source" / "ronin-jump-sheet-raw.png"
OUTPUT_DIR = MOBILE_ROOT / "assets" / "ronin" / "journey" / "jump"
MIN_FRAME_COUNT = 2
MAX_FRAME_COUNT = 12
PAD_PX = 24
GREEN_KEY = np.array([0, 255, 0], dtype=np.float32)
GREEN_TOLERANCE = 90.0  # euclidean RGB distance under which a pixel counts as background

# A "frame" is boy+cat together, but the two aren't always one connected
# blob (sometimes the cat sits apart from the boy) and adjacent frames can
# occasionally touch (e.g. a boot/tail crossing the gap) — so this isn't a
# simple "one component = one frame" sheet. Below: drop noise specks, merge
# nearby components into per-frame groups by horizontal gap, then split any
# group that's implausibly wide (i.e. two touching frames merged into one)
# at its narrowest column.
MIN_COMPONENT_AREA_PX = 500
MERGE_GAP_PX = 15
OVERSIZE_GROUP_RATIO = 1.5  # a merged group this much wider than the median is assumed to be 2 touching frames


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


def component_x_ranges(mask: np.ndarray) -> list[tuple[int, int]]:
    labeled, count = label(mask)
    boxes = find_objects(labeled)
    ranges = []
    for index, box in enumerate(boxes, start=1):
        area = int((mask[box] & (labeled[box] == index)).sum())
        if area >= MIN_COMPONENT_AREA_PX:
            ranges.append((box[1].start, box[1].stop))
    ranges.sort(key=lambda r: r[0])
    return ranges


def merge_into_groups(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:
    groups: list[tuple[int, int]] = []
    for x0, x1 in ranges:
        if groups and x0 - groups[-1][1] <= MERGE_GAP_PX:
            groups[-1] = (groups[-1][0], max(groups[-1][1], x1))
        else:
            groups.append((x0, x1))
    return groups


def split_oversize_groups(mask: np.ndarray, groups: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if len(groups) < 3:
        return groups
    widths = sorted(x1 - x0 for x0, x1 in groups)
    median_width = widths[len(widths) // 2]

    result: list[tuple[int, int]] = []
    for x0, x1 in groups:
        width = x1 - x0
        if width <= median_width * OVERSIZE_GROUP_RATIO:
            result.append((x0, x1))
            continue
        # Two frames touching: find the narrowest column (fewest foreground
        # pixels) in the middle 60% of the group and split there.
        counts = mask[:, x0:x1].sum(axis=0)
        inner_start = int(width * 0.2)
        inner_end = int(width * 0.8)
        split_local = int(np.argmin(counts[inner_start:inner_end])) + inner_start
        split_x = x0 + split_local
        result.append((x0, split_x))
        result.append((split_x, x1))
    return result


def find_character_boxes(mask: np.ndarray) -> list[tuple[slice, slice]]:
    ranges = component_x_ranges(mask)
    groups = merge_into_groups(ranges)
    groups = split_oversize_groups(mask, groups)

    count = len(groups)
    if not (MIN_FRAME_COUNT <= count <= MAX_FRAME_COUNT):
        raise ValueError(
            f"Found {count} pose groups in the sheet, expected between "
            f"{MIN_FRAME_COUNT} and {MAX_FRAME_COUNT}. Check the source sheet for "
            "touching/merged silhouettes or stray specks before re-running."
        )

    boxes = []
    for x0, x1 in groups:
        rows = np.where(mask[:, x0:x1].any(axis=1))[0]
        row_slice = slice(int(rows[0]), int(rows[-1]) + 1)
        boxes.append((row_slice, slice(x0, x1)))
    return boxes


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


def build_frame(
    rgb: np.ndarray,
    mask: np.ndarray,
    box: tuple[slice, slice],
    canvas_width: int,
    canvas_height: int,
    left_pad: int,
    right_pad: int,
    paste_y: int,
) -> Image.Image:
    row_slice, col_slice = box
    top = max(row_slice.start - PAD_PX, 0)
    bottom = min(row_slice.stop + PAD_PX, rgb.shape[0])
    # Horizontal padding is clamped per-neighbor (left_pad/right_pad, computed
    # in main() from the gap to the adjacent group) rather than a flat
    # PAD_PX — frames can sit as little as 0px apart (a waist-split boundary
    # has no gap at all), and a flat pad would crop in a sliver of the
    # neighboring frame.
    left = max(col_slice.start - left_pad, 0)
    right = min(col_slice.stop + right_pad, rgb.shape[1])

    crop_rgb = rgb[top:bottom, left:right]
    crop_mask = mask[top:bottom, left:right]

    distance = np.linalg.norm(crop_rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    alpha = np.clip((distance - GREEN_TOLERANCE * 0.5) / (GREEN_TOLERANCE * 0.5), 0.0, 1.0)
    alpha[~crop_mask] = 0.0
    corrected_rgb = despill(crop_rgb, alpha)

    rgba = np.dstack([corrected_rgb, alpha * 255.0]).astype(np.uint8)
    frame = Image.fromarray(rgba, mode="RGBA")

    # Horizontal centering is safe to do per-frame (it doesn't affect the
    # ground-truth vertical position that fixes the floating bug).
    foreground_cols = np.where(crop_mask.any(axis=0))[0]
    center_x = int((foreground_cols[0] + foreground_cols[-1]) / 2) if len(foreground_cols) else frame.width // 2

    canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    paste_x = canvas_width // 2 - center_x
    canvas.paste(frame, (paste_x, paste_y), frame)
    return canvas


def main() -> None:
    rgb = load_source()
    mask = foreground_mask(rgb)
    boxes = find_character_boxes(mask)

    # Per-frame horizontal padding, clamped to never cross into a neighbor
    # (half the gap to the previous/next frame, capped at PAD_PX; 0 at a
    # zero-gap waist-split boundary).
    pads = []
    for i, (_row_slice, col_slice) in enumerate(boxes):
        prev_gap = col_slice.start - boxes[i - 1][1].stop if i > 0 else PAD_PX * 2
        next_gap = boxes[i + 1][1].start - col_slice.stop if i < len(boxes) - 1 else PAD_PX * 2
        left_pad = max(min(PAD_PX, prev_gap // 2), 0)
        right_pad = max(min(PAD_PX, next_gap // 2), 0)
        pads.append((left_pad, right_pad))

    # Ground-truth vertical alignment: every pose already shares one
    # baseline in the original sheet, so preserve each frame's real
    # top/bottom sheet rows relative to the tightest bounding row range
    # across the WHOLE sheet, rather than re-anchoring each frame
    # independently (which discards genuine height differences between
    # poses — e.g. a crouch vs. a mid-air peak — and turns them into
    # unwanted vertical pop when frames are swapped).
    padded_tops = [max(row_slice.start - PAD_PX, 0) for row_slice, _ in boxes]
    padded_bottoms = [min(row_slice.stop + PAD_PX, rgb.shape[0]) for row_slice, _ in boxes]
    global_top = min(padded_tops)
    global_bottom = max(padded_bottoms)
    canvas_height = global_bottom - global_top

    canvas_width = 0
    for (_row_slice, col_slice), (left_pad, right_pad) in zip(boxes, pads):
        width = (col_slice.stop - col_slice.start) + left_pad + right_pad
        canvas_width = max(canvas_width, width)
    # Square canvas (matches this sheet family's existing convention, and
    # keeps RoninWalkCycleSprite's fixed square Image box filling correctly).
    canvas_size = max(canvas_width, canvas_height)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, (box, (left_pad, right_pad), top) in enumerate(zip(boxes, pads, padded_tops), start=1):
        paste_y = (top - global_top) + (canvas_size - canvas_height) // 2
        frame = build_frame(rgb, mask, box, canvas_size, canvas_size, left_pad, right_pad, paste_y)
        out_path = OUTPUT_DIR / f"ronin-jump-{index:02d}.png"
        frame.save(out_path)
        print(f"wrote {out_path} ({frame.width}x{frame.height})")

    print(f"TOTAL FRAMES: {len(boxes)}")


if __name__ == "__main__":
    main()
