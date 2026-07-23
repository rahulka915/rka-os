#!/usr/bin/env python3
"""Clean keyed hero mattes and render registration diagnostics without regeneration."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy.ndimage import distance_transform_edt


MOBILE_ROOT = Path(__file__).resolve().parents[1]
ENVIRONMENT_ROOT = MOBILE_ROOT / "assets" / "hero" / "environment"
KEYED_ROOT = ENVIRONMENT_ROOT / "keyed"
LAYERS_ROOT = ENVIRONMENT_ROOT / "layers"
DIAGNOSTICS_ROOT = ENVIRONMENT_ROOT / "diagnostics"
REGISTRATION_PATH = (
    MOBILE_ROOT
    / "src"
    / "components"
    / "hero"
    / "environment"
    / "heroEnvironmentRegistration.json"
)

ATMOSPHERIC_LAYERS = {
    "hero_clouds",
    "hero_evening_haze",
    "hero_falling_petals",
    "hero_fireflies",
    "hero_morning_mist",
    "hero_rain",
    "hero_snow",
}

LOW_ALPHA_MATERIAL_TINTS = {
    "hero_morning_mist": np.array([226, 229, 222], dtype=np.float32),
    "hero_evening_haze": np.array([139, 119, 158], dtype=np.float32),
    "hero_rain": np.array([184, 198, 211], dtype=np.float32),
}

INBOX_LAYERS = {
    "empty": "hero_inbox_tray_empty",
    "partial": "hero_inbox_tray_partial",
    "full": "hero_inbox_tray_full",
}

SCENE_LAYER_ORDER = [
    "hero_clouds",
    "hero_fuji",
    "hero_hills",
    "hero_far_shoreline",
    "hero_lake",
    "hero_near_shoreline",
    "hero_veranda",
    "hero_floor",
    "hero_roof",
    "hero_pillar",
    "hero_steps",
    "hero_moss",
    "hero_rocks",
    "hero_lantern",
    "hero_bonsai",
    "hero_meditation_cushion",
    "hero_training_post",
    "hero_sword_stand",
    "hero_inbox_tray_empty",
    "hero_inbox_tray_partial",
    "hero_inbox_tray_full",
    "hero_scroll",
    "hero_scroll_open",
    "hero_morning_mist",
    "hero_evening_haze",
    "hero_rain",
    "hero_snow",
    "hero_fireflies",
    "hero_falling_petals",
]


def load_registration() -> dict:
    return json.loads(REGISTRATION_PATH.read_text())


def smoothstep(low: float, high: float, value: np.ndarray) -> np.ndarray:
    t = np.clip((value - low) / (high - low), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def fit_key_surface(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    height, width, _ = rgb.shape
    yy, xx = np.mgrid[0:height:24, 0:width:24]
    sampled_alpha = alpha[::24, ::24]
    keep = sampled_alpha <= 1
    x = xx[keep].astype(np.float64) / max(width - 1, 1)
    y = yy[keep].astype(np.float64) / max(height - 1, 1)
    design = np.column_stack((np.ones_like(x), x, y, x * y, x * x, y * y))
    samples = rgb[::24, ::24][keep].astype(np.float64)
    coefficients, *_ = np.linalg.lstsq(design, samples, rcond=None)

    full_y, full_x = np.mgrid[0:height, 0:width]
    full_x = full_x.astype(np.float64) / max(width - 1, 1)
    full_y = full_y.astype(np.float64) / max(height - 1, 1)
    full_design = np.stack(
        (
            np.ones_like(full_x),
            full_x,
            full_y,
            full_x * full_y,
            full_x * full_x,
            full_y * full_y,
        ),
        axis=-1,
    )
    return np.clip(full_design @ coefficients, 0, 255).astype(np.float32)


def clean_layer(name: str) -> dict[str, object]:
    keyed_path = KEYED_ROOT / f"{name}.png"
    existing_path = LAYERS_ROOT / f"{name}.png"
    keyed = np.asarray(Image.open(keyed_path).convert("RGB"), dtype=np.float32)
    existing = Image.open(existing_path).convert("RGBA")
    existing_array = np.asarray(existing)
    matte = existing_array[:, :, 3].astype(np.float32)
    key_surface = fit_key_surface(keyed, matte)

    alpha = matte / 255.0
    color_distance = np.linalg.norm(keyed - key_surface, axis=2) / 441.673
    if name in ATMOSPHERIC_LAYERS:
        support = smoothstep(0.002, 0.022, color_distance)
        alpha *= np.clip(support * 1.18, 0.0, 1.0)
        feather_radius = 0.55
    else:
        support = smoothstep(0.006, 0.055, color_distance)
        alpha *= np.clip(support * 1.08, 0.0, 1.0)
        feather_radius = 0.28

    alpha[alpha < (0.7 / 255.0)] = 0.0
    alpha_image = Image.fromarray(np.uint8(np.clip(alpha * 255.0, 0, 255)), "L")
    alpha_image = alpha_image.filter(ImageFilter.GaussianBlur(feather_radius))
    alpha = np.asarray(alpha_image, dtype=np.float32) / 255.0

    if name in LOW_ALPHA_MATERIAL_TINTS:
        tint = LOW_ALPHA_MATERIAL_TINTS[name]
        variation = np.clip(color_distance / max(float(color_distance.max()), 0.001), 0.0, 1.0)
        variation = (variation - 0.5)[:, :, None] * 20.0
        foreground = np.clip(tint[None, None, :] + variation, 0, 255)
    else:
        opaque = alpha >= (0.72 if name in ATMOSPHERIC_LAYERS else 0.86)
        if opaque.any():
            _, nearest = distance_transform_edt(~opaque, return_indices=True)
            nearest_color = keyed[nearest[0], nearest[1]]
            edge_mix = np.clip((0.92 - alpha) / 0.72, 0.0, 1.0)[:, :, None]
            foreground = keyed * (1.0 - edge_mix) + nearest_color * edge_mix
        else:
            foreground = existing_array[:, :, :3].astype(np.float32)
    foreground[alpha <= 0.0] = 0.0

    output = np.dstack((foreground.astype(np.uint8), np.uint8(np.clip(alpha * 255.0, 0, 255))))
    Image.fromarray(output, "RGBA").save(existing_path, optimize=True)
    nonzero = np.argwhere(output[:, :, 3] > 0)
    bbox = None
    if len(nonzero):
        y0, x0 = nonzero.min(axis=0)
        y1, x1 = nonzero.max(axis=0) + 1
        bbox = [int(x0), int(y0), int(x1), int(y1)]
    return {
        "name": name,
        "alphaMin": int(output[:, :, 3].min()),
        "alphaMax": int(output[:, :, 3].max()),
        "bbox": bbox,
    }


def scene_background(width: int, height: int) -> Image.Image:
    top = np.array([205, 198, 181], dtype=np.float32)
    bottom = np.array([126, 145, 154], dtype=np.float32)
    t = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None, None]
    rgb = top[None, None, :] * (1.0 - t) + bottom[None, None, :] * t
    rgb = np.repeat(rgb, width, axis=1)
    return Image.fromarray(np.uint8(rgb), "RGB").convert("RGBA")


def registered_layer(name: str, registration: dict) -> Image.Image:
    scene_width = registration["scene"]["width"]
    scene_height = registration["scene"]["height"]
    values = registration["layers"][name]
    layer = Image.open(LAYERS_ROOT / f"{name}.png").convert("RGBA")
    scale = values["scale"]
    scaled = layer.resize(
        (max(1, round(scene_width * scale)), max(1, round(scene_height * scale))),
        Image.Resampling.LANCZOS,
    )
    rotation = values.get("rotation", 0)
    if rotation:
        scaled = scaled.rotate(-rotation, Image.Resampling.BICUBIC, expand=False)
    opacity = values.get("opacity", 1)
    if opacity != 1:
        scaled.putalpha(scaled.getchannel("A").point(lambda value: round(value * opacity)))
    canvas = Image.new("RGBA", (scene_width, scene_height))
    canvas.alpha_composite(scaled, (round(values["x"]), round(values["y"])))
    return canvas


def render_scene(
    registration: dict,
    *,
    inbox_state: str = "partial",
    focus_state: str = "active",
    atmosphere: str | None = None,
    weather: str = "clear",
) -> Image.Image:
    width = registration["scene"]["width"]
    height = registration["scene"]["height"]
    scene = scene_background(width, height)
    chosen_inbox = INBOX_LAYERS[inbox_state]
    chosen_scroll = "hero_scroll_open" if focus_state == "active" else "hero_scroll"
    weather_layer = None if weather == "clear" else f"hero_{weather}"
    for name in SCENE_LAYER_ORDER:
        if name in INBOX_LAYERS.values() and name != chosen_inbox:
            continue
        if name in {"hero_scroll", "hero_scroll_open"} and name != chosen_scroll:
            continue
        if name in {"hero_morning_mist", "hero_evening_haze"} and name != atmosphere:
            continue
        if name in {"hero_rain", "hero_snow", "hero_fireflies", "hero_falling_petals"} and name != weather_layer:
            continue
        scene.alpha_composite(registered_layer(name, registration))
    return scene


def checkerboard(width: int, height: int, cell: int = 18) -> Image.Image:
    image = Image.new("RGBA", (width, height), "#171a21")
    draw = ImageDraw.Draw(image)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#232731")
    return image


def create_contact_sheet(registration: dict) -> None:
    tile_width, tile_height = 384, 248
    columns = 4
    rows = (len(SCENE_LAYER_ORDER) + columns - 1) // columns
    sheet = Image.new("RGB", (tile_width * columns, tile_height * rows), "#0b0d12")
    font = ImageFont.load_default(size=18)
    for index, name in enumerate(SCENE_LAYER_ORDER):
        tile = checkerboard(tile_width, tile_height)
        layer = Image.open(LAYERS_ROOT / f"{name}.png").convert("RGBA")
        layer.thumbnail((tile_width, tile_height - 34), Image.Resampling.LANCZOS)
        tile.alpha_composite(layer, ((tile_width - layer.width) // 2, 0))
        draw = ImageDraw.Draw(tile)
        draw.rectangle((0, tile_height - 32, tile_width, tile_height), fill="#090b10e8")
        draw.text((12, tile_height - 26), name, font=font, fill="#e8dfd0")
        x = (index % columns) * tile_width
        y = (index // columns) * tile_height
        sheet.paste(tile.convert("RGB"), (x, y))
    sheet.save(DIAGNOSTICS_ROOT / "cleaned-layers-contact-sheet.png", optimize=True)


def add_guides(scene: Image.Image, registration: dict) -> Image.Image:
    guided = scene.copy()
    draw = ImageDraw.Draw(guided, "RGBA")
    guides = registration["guides"]
    viewport = registration["viewport"]
    width, height = scene.size
    draw.rectangle((0, 0, width - 1, height - 1), outline="#6aa9ffff", width=4)
    draw.line((0, registration["scene"]["horizonY"], width, registration["scene"]["horizonY"]), fill="#62d5c8e6", width=3)
    crop = viewport["crop"]
    draw.rectangle(
        (crop["x"], crop["y"], crop["x"] + crop["width"], crop["y"] + crop["height"]),
        outline="#d6ad62ff",
        width=4,
    )
    safe = viewport["safeCrop"]
    draw.rectangle(
        (safe["x"], safe["y"], safe["x"] + safe["width"], safe["y"] + safe["height"]),
        outline="#ffffffff",
        width=2,
    )
    draw.line((guides["fujiCenter"]["x"] - 24, guides["fujiCenter"]["y"], guides["fujiCenter"]["x"] + 24, guides["fujiCenter"]["y"]), fill="#ff7b7bff", width=3)
    draw.line((guides["fujiCenter"]["x"], guides["fujiCenter"]["y"] - 24, guides["fujiCenter"]["x"], guides["fujiCenter"]["y"] + 24), fill="#ff7b7bff", width=3)
    draw.line((guides["verandaLeft"], 0, guides["verandaLeft"], height), fill="#ffcf66cc", width=3)
    draw.line((guides["verandaRight"] - 1, 0, guides["verandaRight"] - 1, height), fill="#ffcf66cc", width=3)
    draw.line((0, guides["deckTop"], width, guides["deckTop"]), fill="#ffcf66cc", width=3)
    for anchor in guides["anchors"].values():
        x, y = anchor["x"], anchor["y"]
        draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill="#5fd7ffe6", outline="#071019ff", width=2)
    return guided


def crop_to_hero(scene: Image.Image, registration: dict, width: int = 780) -> Image.Image:
    crop = registration["viewport"]["crop"]
    region = scene.crop((crop["x"], crop["y"], crop["x"] + crop["width"], crop["y"] + crop["height"]))
    height = round(width * crop["height"] / crop["width"])
    return region.resize((width, height), Image.Resampling.LANCZOS)


def create_diagnostics(registration: dict, report: list[dict[str, object]]) -> None:
    DIAGNOSTICS_ROOT.mkdir(parents=True, exist_ok=True)
    scene = render_scene(registration, inbox_state="partial", focus_state="active")
    scene.save(DIAGNOSTICS_ROOT / "registered-scene.png", optimize=True)
    add_guides(scene, registration).save(DIAGNOSTICS_ROOT / "registered-scene-guides.png", optimize=True)
    crop_to_hero(scene, registration).save(DIAGNOSTICS_ROOT / "riverstone-hero-crop.png", optimize=True)

    states = [
        crop_to_hero(render_scene(registration, inbox_state=state, focus_state="active"), registration, 640)
        for state in ("empty", "partial", "full")
    ]
    state_sheet = Image.new("RGB", (640 * 3, states[0].height + 44), "#0b0d12")
    font = ImageFont.load_default(size=20)
    draw = ImageDraw.Draw(state_sheet)
    for index, (label, state_image) in enumerate(zip(("EMPTY", "PARTIAL", "FULL"), states)):
        state_sheet.paste(state_image.convert("RGB"), (index * 640, 0))
        draw.text((index * 640 + 16, states[0].height + 12), label, font=font, fill="#e8dfd0")
    state_sheet.save(DIAGNOSTICS_ROOT / "inbox-states.png", optimize=True)
    create_contact_sheet(registration)
    (DIAGNOSTICS_ROOT / "alpha-cleanup-report.json").write_text(json.dumps(report, indent=2) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--diagnostics-only", action="store_true")
    args = parser.parse_args()
    registration = load_registration()
    LAYERS_ROOT.mkdir(parents=True, exist_ok=True)
    report: list[dict[str, object]] = []
    if not args.diagnostics_only:
        for name in SCENE_LAYER_ORDER:
            report.append(clean_layer(name))
    else:
        report_path = DIAGNOSTICS_ROOT / "alpha-cleanup-report.json"
        if report_path.exists():
            report = json.loads(report_path.read_text())
    create_diagnostics(registration, report)


if __name__ == "__main__":
    main()
