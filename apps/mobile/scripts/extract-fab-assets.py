#!/usr/bin/env python3
"""Extract registered FAB frames directly from the locked design master."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


MOBILE_ROOT = Path(__file__).resolve().parents[1]
FAB_ROOT = MOBILE_ROOT / "assets" / "fab"
MASTER_PATH = FAB_ROOT / "source" / "fab-design-master.png"
FRAMES_ROOT = FAB_ROOT / "frames"
MATERIALS_ROOT = FAB_ROOT / "materials"
CANVAS_SIZE = 192
CROP_SIZE = 200

FRAME_CENTRES = {
    "idle": (101, 184),
    "hover": (300, 184),
    "pressed": (497, 184),
    "brush-raised": (693, 184),
    "stroke-01": (101, 421),
    "stroke-02": (264, 421),
    "stroke-03": (430, 421),
    "stroke-04": (595, 421),
    "stroke-05": (760, 421),
    "unfold-begin": (101, 659),
    "unfold-half": (262, 659),
    "unfold-full": (421, 659),
    "brush-fade": (580, 659),
    "paper-only": (745, 659),
}

MATERIAL_CENTRES = {
    "bamboo-handle": (945, 411),
    "lacquer-ferrule": (1069, 411),
    "brush-tip": (1191, 411),
    "washi-paper": (1315, 411),
    "ink-stroke": (1438, 411),
}


def largest_component(mask: np.ndarray, seed_region: np.ndarray) -> np.ndarray:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    best: list[tuple[int, int]] = []
    seeded_best: list[tuple[int, int]] = []

    for start_y, start_x in zip(*np.nonzero(mask & ~visited)):
        queue = deque([(int(start_y), int(start_x))])
        visited[start_y, start_x] = True
        component: list[tuple[int, int]] = []
        touches_seed = False
        while queue:
            y, x = queue.popleft()
            component.append((y, x))
            touches_seed = touches_seed or bool(seed_region[y, x])
            for next_y in range(max(0, y - 1), min(height, y + 2)):
                for next_x in range(max(0, x - 1), min(width, x + 2)):
                    if mask[next_y, next_x] and not visited[next_y, next_x]:
                        visited[next_y, next_x] = True
                        queue.append((next_y, next_x))
        if len(component) > len(best):
            best = component
        if touches_seed and len(component) > len(seeded_best):
            seeded_best = component

    chosen = seeded_best or best
    output = np.zeros_like(mask, dtype=bool)
    if chosen:
        ys, xs = zip(*chosen)
        output[np.asarray(ys), np.asarray(xs)] = True
    return output


def extract_frame(master: Image.Image, name: str, centre: tuple[int, int]) -> dict[str, object]:
    left = centre[0] - CROP_SIZE // 2
    top = centre[1] - CROP_SIZE // 2
    crop = master.crop((left, top, left + CROP_SIZE, top + CROP_SIZE)).convert("RGB")
    rgb = np.asarray(crop, dtype=np.float32)

    background = np.array([240.0, 238.0, 233.0], dtype=np.float32)
    distance = np.linalg.norm(rgb - background, axis=2)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    disc = (blue > red * 1.15) & (blue > green * 1.04) & (red < 90) & (green < 115)
    disc_points = np.argwhere(disc)
    if not len(disc_points):
        raise RuntimeError(f"Could not locate FAB disc for {name}")

    disc_y, disc_x = np.median(disc_points, axis=0)
    yy, xx = np.mgrid[0:CROP_SIZE, 0:CROP_SIZE]
    radius = np.sqrt((xx - disc_x) ** 2 + (yy - disc_y) ** 2)
    seed_region = radius <= 70
    component = largest_component(distance > 11, seed_region)
    brush_extension = (xx >= disc_x + 8) & (yy <= disc_y - 16) & (radius <= 94)
    is_morph = name.startswith("unfold-") or name in {"brush-fade", "paper-only"}
    warm_paper = (red - blue) >= 13
    morph_extension = is_morph & warm_paper & (radius <= 87)
    support = component & ((radius <= 77) | brush_extension | morph_extension)

    alpha = np.zeros((CROP_SIZE, CROP_SIZE), dtype=np.float32)
    subject = support & (
        ((radius <= 71) & (distance >= 18))
        | (brush_extension & (distance >= 18))
        | morph_extension
    )
    alpha[subject] = 1.0
    alpha[support & (radius <= 66.5)] = 1.0
    edge = support & (alpha == 0) & (radius <= 71)
    alpha[edge] = np.clip((distance[edge] - 8) / 21, 0, 1)
    shadow = support & (alpha == 0)
    shadow_alpha = np.clip(np.mean((background - rgb) / background, axis=2), 0, 1)
    alpha[shadow] = shadow_alpha[shadow]
    alpha_image = Image.fromarray(np.uint8(alpha * 255), "L").filter(ImageFilter.GaussianBlur(0.32))
    alpha = np.asarray(alpha_image, dtype=np.uint8)

    foreground = rgb.astype(np.uint8)
    partial = (alpha > 0) & (alpha < 255)
    neutral_edge = (np.abs(red - green) < 12) & (np.abs(green - blue) < 18)
    disc_edge = partial & (radius >= 64) & (radius <= 73) & ((blue > red) | neutral_edge)
    shadow_edge = partial & (radius > 73) & ~brush_extension & ~morph_extension
    foreground[disc_edge] = np.array([39, 75, 143], dtype=np.uint8)
    foreground[shadow] = 0
    foreground[shadow_edge] = 0
    rgba = np.dstack((foreground, alpha))
    rgba[alpha == 0, :3] = 0
    extracted = Image.fromarray(rgba, "RGBA")

    output = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE))
    offset_x = round(CANVAS_SIZE / 2 - disc_x)
    offset_y = round(CANVAS_SIZE / 2 - disc_y)
    output.alpha_composite(extracted, (offset_x, offset_y))
    output_path = FRAMES_ROOT / f"fab-{name}.png"
    output.save(output_path, optimize=True)

    output_alpha = np.asarray(output.getchannel("A"))
    nonzero = np.argwhere(output_alpha > 0)
    y0, x0 = nonzero.min(axis=0)
    y1, x1 = nonzero.max(axis=0) + 1
    return {
        "name": name,
        "file": f"frames/{output_path.name}",
        "canvas": [CANVAS_SIZE, CANVAS_SIZE],
        "discCentre": [CANVAS_SIZE // 2, CANVAS_SIZE // 2],
        "contentBounds": [int(x0), int(y0), int(x1), int(y1)],
    }


def extract_material(master: Image.Image, name: str, centre: tuple[int, int]) -> dict[str, object]:
    width, height = 116, 136
    left = round(centre[0] - width / 2)
    top = round(centre[1] - height / 2)
    crop = master.crop((left, top, left + width, top + height)).convert("RGBA")
    mask = Image.new("L", (width, height))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=13, fill=255)
    crop.putalpha(mask.filter(ImageFilter.GaussianBlur(0.3)))

    output = Image.new("RGBA", (160, 160))
    output.alpha_composite(crop, ((160 - width) // 2, (160 - height) // 2))
    output_path = MATERIALS_ROOT / f"fab-material-{name}.png"
    output.save(output_path, optimize=True)
    return {
        "name": name,
        "file": f"materials/{output_path.name}",
        "canvas": [160, 160],
    }


def main() -> None:
    FRAMES_ROOT.mkdir(parents=True, exist_ok=True)
    MATERIALS_ROOT.mkdir(parents=True, exist_ok=True)
    master = Image.open(MASTER_PATH).convert("RGB")

    frames = [extract_frame(master, name, centre) for name, centre in FRAME_CENTRES.items()]
    materials = [extract_material(master, name, centre) for name, centre in MATERIAL_CENTRES.items()]
    manifest = {
        "designMaster": "source/fab-design-master.png",
        "frameCanvas": [CANVAS_SIZE, CANVAS_SIZE],
        "registrationPoint": [CANVAS_SIZE // 2, CANVAS_SIZE // 2],
        "frames": frames,
        "materials": materials,
        "motion": {
            "pressMs": 100,
            "touchMs": 180,
            "inkMs": 280,
            "unfoldMs": 380,
            "composeOpenMs": 520,
            "easing": [0.22, 1, 0.36, 1],
        },
    }
    (FAB_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
