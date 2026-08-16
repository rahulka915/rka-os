#!/usr/bin/env python3
"""Slice, align, and key a Ronin sprite sheet (walk-cycle or idle-breathing) into individual frame PNGs.

Input: a single green-screen (#00FF00) sheet containing N side-profile poses, left to right,
generated per docs/superpowers/specs/2026-08-15-simplified-walking-ronin-avatar-design.md.

Output: <output-dir>/<prefix>-01.png .. <prefix>-N.png, each on an identical-size transparent
canvas, head-top-anchored so frame-swapping doesn't jitter.

Usage:
    python3 scripts/build-ronin-walk-cycle-frames.py \
        --source assets/ronin/journey/walk-cycle/source/ronin-walk-cycle-sheet-raw.png \
        --output-dir assets/ronin/journey/walk-cycle \
        --frame-count 8 \
        --prefix ronin-walk

    python3 scripts/build-ronin-walk-cycle-frames.py \
        --source assets/ronin/journey/idle/source/ronin-idle-sheet-raw.png \
        --output-dir assets/ronin/journey/idle \
        --frame-count 4 \
        --prefix ronin-idle
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion, gaussian_filter, label, find_objects

MOBILE_ROOT = Path(__file__).resolve().parents[1]
PAD_PX = 24
GREEN_KEY = np.array([0, 255, 0], dtype=np.float32)
GREEN_TOLERANCE = 90.0  # euclidean RGB distance under which a pixel counts as background
HEAD_TOP_MARGIN_PX = 20  # distance from canvas top to each frame's topmost foreground pixel
EDGE_EROSION_PX = 2  # shrink the foreground mask by this many px before compositing, to drop unreliable green-key edge pixels
ALPHA_FEATHER_SIGMA = 0.8  # Gaussian blur radius applied to the alpha channel only, softens the eroded edge instead of leaving a hard cutoff
DESPILL_REACH = 3.5  # despill correction ramps in over this many multiples of GREEN_TOLERANCE, applied by raw distance-to-key, not by alpha


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, help="Path to the raw green-screen sheet (repo-relative or absolute)")
    parser.add_argument("--output-dir", required=True, help="Directory to write the sliced frame PNGs into (repo-relative or absolute)")
    parser.add_argument("--frame-count", type=int, required=True, help="Number of poses in the sheet, left to right")
    parser.add_argument("--prefix", required=True, help="Output filename prefix, e.g. 'ronin-walk' -> ronin-walk-01.png")
    return parser.parse_args()


def resolve(path_str: str) -> Path:
    path = Path(path_str)
    return path if path.is_absolute() else MOBILE_ROOT / path


def load_source(source_path: Path) -> np.ndarray:
    if not source_path.exists():
        raise FileNotFoundError(
            f"Raw sprite sheet not found at {source_path}. Save the generated sheet there before running this script."
        )
    image = Image.open(source_path).convert("RGB")
    return np.array(image)


def foreground_mask(rgb: np.ndarray) -> np.ndarray:
    distance = np.linalg.norm(rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    return distance > GREEN_TOLERANCE


def find_character_boxes(mask: np.ndarray, frame_count: int) -> list[tuple[slice, slice]]:
    labeled, count = label(mask)
    if count != frame_count:
        raise ValueError(
            f"Expected {frame_count} separate characters in the sheet, found {count}. "
            "Check the source sheet for touching/merged silhouettes before re-running."
        )
    boxes = find_objects(labeled)
    # Sort left-to-right by the box's horizontal start, matching pose order.
    return sorted(boxes, key=lambda box: box[1].start)


def despill(rgb: np.ndarray, distance: np.ndarray) -> np.ndarray:
    # Standard green-spill fix: pull green down toward the min of red/blue
    # for any pixel still close to the green key, regardless of whether it
    # ended up opaque or semi-transparent. Gating this by alpha (as opposed
    # to raw distance-to-key) was the actual bug behind the visible fringe —
    # a rim pixel that's opaque-but-still-greenish (distance just past the
    # foreground cutoff) got alpha=1 and therefore NO correction under an
    # alpha-gated formula, even though it's exactly the pixel that reads as
    # a green fringe once composited over a non-green background.
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    # 0 at the green key itself, ramping to 1 by DESPILL_REACH * GREEN_TOLERANCE away.
    correction = np.clip(distance / (GREEN_TOLERANCE * DESPILL_REACH), 0.0, 1.0)
    corrected_g = np.where(
        g > np.minimum(r, b),
        np.minimum(r, b) + (g - np.minimum(r, b)) * correction,
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

    # Erode the mask by EDGE_EROSION_PX before compositing: the outermost
    # ring of keyed pixels is the least reliable green-key data (most mixed
    # with background), so we discard it rather than try to color-correct
    # it — this is what actually kills the residual green fringe that a
    # despill-only pass leaves behind.
    eroded_mask = binary_erosion(crop_mask, iterations=EDGE_EROSION_PX) if EDGE_EROSION_PX > 0 else crop_mask

    distance = np.linalg.norm(crop_rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    # Narrower falloff band (0.85x tolerance instead of 0.5x) means fewer
    # semi-transparent edge pixels retain any green tint at all.
    alpha = np.clip((distance - GREEN_TOLERANCE * 0.85) / (GREEN_TOLERANCE * 0.15), 0.0, 1.0)
    alpha[~eroded_mask] = 0.0
    if ALPHA_FEATHER_SIGMA > 0:
        alpha = gaussian_filter(alpha, sigma=ALPHA_FEATHER_SIGMA)
    corrected_rgb = despill(crop_rgb, distance)

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
    args = parse_args()
    source_path = resolve(args.source)
    output_dir = resolve(args.output_dir)

    rgb = load_source(source_path)
    mask = foreground_mask(rgb)
    boxes = find_character_boxes(mask, args.frame_count)

    # Canvas must fit the largest cropped frame plus padding, shared by every
    # frame so swapping never changes the Image element's own size.
    max_dim = 0
    for row_slice, col_slice in boxes:
        height = (row_slice.stop - row_slice.start) + PAD_PX * 2
        width = (col_slice.stop - col_slice.start) + PAD_PX * 2
        max_dim = max(max_dim, height, width)

    output_dir.mkdir(parents=True, exist_ok=True)
    for index, box in enumerate(boxes, start=1):
        frame = build_frame(rgb, mask, box, max_dim)
        out_path = output_dir / f"{args.prefix}-{index:02d}.png"
        frame.save(out_path)
        print(f"wrote {out_path} ({frame.width}x{frame.height})")


if __name__ == "__main__":
    main()
