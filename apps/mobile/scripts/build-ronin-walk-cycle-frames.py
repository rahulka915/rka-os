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

    # For a source that's already a transparent PNG (real alpha channel,
    # no green-key background) rather than a chroma-key sheet — skips the
    # green-key/despill/erosion pipeline entirely and just uses the
    # existing alpha as the foreground mask. --min-area drops small
    # antialiasing-noise blobs (stray 1px specks) that would otherwise
    # throw off the expected frame-count check.
    python3 scripts/build-ronin-walk-cycle-frames.py \
        --source assets/ronin/journey/tap-reaction/source/ronin-tap-reaction-sheet-raw.png \
        --output-dir assets/ronin/journey/tap-reaction \
        --frame-count 6 \
        --prefix ronin-tap \
        --already-alpha --min-area 1000

"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
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


@dataclass(frozen=True)
class CanvasContract:
    width: int
    height: int
    safe_padding: int
    ground_baseline_y: int
    root_x: int
    root_y: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, help="Path to the raw green-screen sheet (repo-relative or absolute)")
    parser.add_argument("--output-dir", required=True, help="Directory to write the sliced frame PNGs into (repo-relative or absolute)")
    parser.add_argument("--frame-count", type=int, required=True, help="Number of poses in the sheet, left to right")
    parser.add_argument("--prefix", required=True, help="Output filename prefix, e.g. 'ronin-walk' -> ronin-walk-01.png")
    parser.add_argument(
        "--already-alpha",
        action="store_true",
        help="Source is already a transparent PNG (real alpha channel) rather than a green-key sheet — skip green-key/despill/erosion.",
    )
    parser.add_argument(
        "--min-area",
        type=int,
        default=0,
        help="Drop connected components smaller than this many pixels before the frame-count check (useful for --already-alpha sources with antialiasing noise specks).",
    )
    parser.add_argument(
        "--canvas-contract",
        help="JSON canvas contract for fixed-coordinate production export. Omit to retain legacy auto-sized/head-anchored behaviour.",
    )
    parser.add_argument(
        "--cell-width",
        type=int,
        help="Width of each authored frame cell in fixed-coordinate mode. Must match the contract width.",
    )
    parser.add_argument(
        "--allow-safe-area-overflow",
        action="store_true",
        help="Allow foreground inside the contract safety padding for actions that explicitly require it.",
    )
    return parser.parse_args()


def resolve(path_str: str) -> Path:
    path = Path(path_str)
    return path if path.is_absolute() else MOBILE_ROOT / path


def load_source_rgb(source_path: Path) -> np.ndarray:
    if not source_path.exists():
        raise FileNotFoundError(
            f"Raw sprite sheet not found at {source_path}. Save the generated sheet there before running this script."
        )
    image = Image.open(source_path).convert("RGB")
    return np.array(image)


def load_source_rgba(source_path: Path) -> np.ndarray:
    if not source_path.exists():
        raise FileNotFoundError(
            f"Raw sprite sheet not found at {source_path}. Save the generated sheet there before running this script."
        )
    image = Image.open(source_path).convert("RGBA")
    return np.array(image)


def load_canvas_contract(contract_path: Path) -> CanvasContract:
    raw = json.loads(contract_path.read_text())
    if raw.get("schemaVersion") != 1:
        raise ValueError(f"Unsupported canvas contract schemaVersion: {raw.get('schemaVersion')}")
    root = raw["rootAnchor"]
    contract = CanvasContract(
        width=int(raw["width"]),
        height=int(raw["height"]),
        safe_padding=int(raw["safePadding"]),
        ground_baseline_y=int(raw["groundBaselineY"]),
        root_x=int(root["x"]),
        root_y=int(root["y"]),
    )
    if contract.width <= 0 or contract.height <= 0:
        raise ValueError("Canvas contract dimensions must be positive")
    if contract.safe_padding < 0 or contract.safe_padding * 2 >= min(contract.width, contract.height):
        raise ValueError("Canvas contract safePadding is invalid")
    return contract


def foreground_mask(rgb: np.ndarray) -> np.ndarray:
    distance = np.linalg.norm(rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    return distance > GREEN_TOLERANCE


def find_character_boxes(
    mask: np.ndarray, frame_count: int, min_area: int = 0
) -> tuple[list[tuple[tuple[slice, slice], int]], np.ndarray]:
    labeled, count = label(mask)
    all_boxes = find_objects(labeled)
    entries = [(box, index) for index, box in enumerate(all_boxes, start=1)]
    if min_area > 0:
        entries = [(box, index) for box, index in entries if int((labeled[box] == index).sum()) >= min_area]
    if len(entries) != frame_count:
        raise ValueError(
            f"Expected {frame_count} separate characters in the sheet, found {len(entries)}. "
            "Check the source sheet for touching/merged silhouettes, or tune --min-area, before re-running."
        )
    # Sort left-to-right by the box's horizontal start, matching pose order.
    entries.sort(key=lambda entry: entry[0][1].start)
    return entries, labeled


def calculate_legacy_canvas_size(entries: list[tuple[tuple[slice, slice], int]]) -> int:
    max_dim = 0
    for (row_slice, col_slice), _label_id in entries:
        height = (row_slice.stop - row_slice.start) + PAD_PX * 2
        width = (col_slice.stop - col_slice.start) + PAD_PX * 2
        max_dim = max(max_dim, height, width)
    return max_dim


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


def keyed_rgba(rgb: np.ndarray) -> np.ndarray:
    mask = foreground_mask(rgb)
    eroded_mask = binary_erosion(mask, iterations=EDGE_EROSION_PX) if EDGE_EROSION_PX > 0 else mask
    distance = np.linalg.norm(rgb.astype(np.float32) - GREEN_KEY, axis=-1)
    alpha = np.clip((distance - GREEN_TOLERANCE * 0.85) / (GREEN_TOLERANCE * 0.15), 0.0, 1.0)
    alpha[~eroded_mask] = 0.0
    if ALPHA_FEATHER_SIGMA > 0:
        alpha = gaussian_filter(alpha, sigma=ALPHA_FEATHER_SIGMA)
    return np.dstack([despill(rgb, distance), alpha * 255.0]).astype(np.uint8)


def validate_safe_area(alpha: np.ndarray, contract: CanvasContract, frame_number: int) -> None:
    foreground = alpha > 10
    rows, cols = np.where(foreground)
    if len(rows) == 0:
        raise ValueError(f"Frame {frame_number} has no visible foreground")
    padding = contract.safe_padding
    if cols.min() < padding or cols.max() >= contract.width - padding or rows.min() < padding or rows.max() >= contract.height - padding:
        raise ValueError(f"Frame {frame_number} foreground extends outside the {padding}px safe area")


def build_fixed_frames(
    source: np.ndarray,
    contract: CanvasContract,
    frame_count: int,
    cell_width: int,
    already_alpha: bool,
    allow_safe_area_overflow: bool,
) -> list[Image.Image]:
    if cell_width != contract.width:
        raise ValueError(f"Fixed cell width {cell_width} must match contract width {contract.width}")
    if source.shape[0] != contract.height or source.shape[1] != cell_width * frame_count:
        raise ValueError(
            f"Fixed sheet must be {cell_width * frame_count}x{contract.height}, got {source.shape[1]}x{source.shape[0]}"
        )

    frames: list[Image.Image] = []
    for index in range(frame_count):
        cell = source[:, index * cell_width : (index + 1) * cell_width]
        if already_alpha:
            if cell.shape[-1] != 4:
                raise ValueError("--already-alpha fixed sheets must have an RGBA channel")
            rgba = cell.copy()
        else:
            rgba = keyed_rgba(cell[..., :3])
        if not allow_safe_area_overflow:
            validate_safe_area(rgba[..., 3], contract, index + 1)
        frames.append(Image.fromarray(rgba, mode="RGBA"))
    return frames


def build_frame(
    rgb: np.ndarray,
    mask: np.ndarray,
    box: tuple[slice, slice],
    canvas_size: int,
    already_alpha: bool = False,
    source_alpha: np.ndarray | None = None,
    labeled: np.ndarray | None = None,
    label_id: int | None = None,
) -> Image.Image:
    row_slice, col_slice = box
    top = max(row_slice.start - PAD_PX, 0)
    bottom = min(row_slice.stop + PAD_PX, rgb.shape[0])
    left = max(col_slice.start - PAD_PX, 0)
    right = min(col_slice.stop + PAD_PX, rgb.shape[1])

    crop_rgb = rgb[top:bottom, left:right]
    crop_mask = mask[top:bottom, left:right]

    if already_alpha:
        # Source already has a real, clean alpha channel — no green-key
        # spill to correct, so skip erosion/despill/feather entirely and
        # just use its own alpha values as-is. Restrict to THIS connected
        # component only — the padded crop rectangle can otherwise clip in
        # stray pixels (a neighboring frame's hair/tail) that fall inside
        # the padding margin but belong to a different pose.
        assert source_alpha is not None and labeled is not None and label_id is not None
        crop_alpha = source_alpha[top:bottom, left:right].copy()
        crop_labeled = labeled[top:bottom, left:right]
        crop_alpha[crop_labeled != label_id] = 0
        crop_mask = crop_labeled == label_id
        rgba = np.dstack([crop_rgb, crop_alpha]).astype(np.uint8)
        frame = Image.fromarray(rgba, mode="RGBA")
    else:
        # Restrict to THIS connected component only — the padded crop
        # rectangle can otherwise pull in a stray disconnected fragment (a
        # flying bandana-tail accent, a neighboring frame's loose sword tip)
        # that falls inside the rectangle but belongs to a different pose.
        # Bounding boxes of adjacent frames can legitimately overlap in x
        # when such fragments drift wide of the main silhouette.
        if labeled is not None and label_id is not None:
            crop_labeled = labeled[top:bottom, left:right]
            crop_mask = crop_labeled == label_id

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

    if args.canvas_contract:
        if args.cell_width is None:
            raise ValueError("--cell-width is required with --canvas-contract")
        contract = load_canvas_contract(resolve(args.canvas_contract))
        source = load_source_rgba(source_path) if args.already_alpha else load_source_rgb(source_path)
        frames = build_fixed_frames(
            source,
            contract,
            frame_count=args.frame_count,
            cell_width=args.cell_width,
            already_alpha=args.already_alpha,
            allow_safe_area_overflow=args.allow_safe_area_overflow,
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        for index, frame in enumerate(frames, start=1):
            out_path = output_dir / f"{args.prefix}-{index:02d}.png"
            frame.save(out_path)
            print(f"wrote {out_path} ({frame.width}x{frame.height})")
        return

    source_alpha = None
    if args.already_alpha:
        rgba_source = load_source_rgba(source_path)
        rgb = rgba_source[..., :3]
        source_alpha = rgba_source[..., 3]
        mask = source_alpha > 10
    else:
        rgb = load_source_rgb(source_path)
        mask = foreground_mask(rgb)

    entries, labeled = find_character_boxes(mask, args.frame_count, min_area=args.min_area)

    # Canvas must fit the largest cropped frame plus padding, shared by every
    # frame so swapping never changes the Image element's own size.
    max_dim = calculate_legacy_canvas_size(entries)

    output_dir.mkdir(parents=True, exist_ok=True)
    for index, (box, label_id) in enumerate(entries, start=1):
        frame = build_frame(
            rgb,
            mask,
            box,
            max_dim,
            already_alpha=args.already_alpha,
            source_alpha=source_alpha,
            labeled=labeled,
            label_id=label_id,
        )
        out_path = output_dir / f"{args.prefix}-{index:02d}.png"
        frame.save(out_path)
        print(f"wrote {out_path} ({frame.width}x{frame.height})")


if __name__ == "__main__":
    main()
