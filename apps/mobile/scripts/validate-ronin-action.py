#!/usr/bin/env python3
"""Validate a versioned Ronin PNG action against its manifest and canvas contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image


def load_json(path: Path, label: str, errors: list[str]) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text())
    except FileNotFoundError:
        errors.append(f"Missing {label}: {path}")
        return None
    except json.JSONDecodeError as error:
        errors.append(f"Invalid {label} JSON at {path}: {error}")
        return None
    if not isinstance(value, dict):
        errors.append(f"Invalid {label}: expected a JSON object")
        return None
    return value


def validate_manifest_fields(manifest: dict[str, Any], errors: list[str]) -> None:
    if manifest.get("schemaVersion") != 1:
        errors.append(f"Unsupported action schemaVersion: {manifest.get('schemaVersion')}")
    if not isinstance(manifest.get("action"), str) or not manifest["action"]:
        errors.append("Manifest action must be a non-empty string")
    if not isinstance(manifest.get("identityPackVersion"), str) or not manifest["identityPackVersion"]:
        errors.append("Manifest identityPackVersion must be a non-empty string")
    if not isinstance(manifest.get("framePrefix"), str) or not manifest["framePrefix"]:
        errors.append("Manifest framePrefix must be a non-empty string")
    if not isinstance(manifest.get("frameCount"), int) or manifest["frameCount"] <= 0:
        errors.append("Manifest frameCount must be a positive integer")
    if not isinstance(manifest.get("intervalMs"), int) or manifest["intervalMs"] <= 0:
        errors.append("Manifest intervalMs must be a positive integer")
    if manifest.get("loopMode") not in {"loop", "once"}:
        errors.append("Manifest loopMode must be 'loop' or 'once'")
    if not isinstance(manifest.get("contactFrames"), list):
        errors.append("Manifest contactFrames must be an array")
    if not isinstance(manifest.get("baselineTolerancePx"), int) or manifest["baselineTolerancePx"] < 0:
        errors.append("Manifest baselineTolerancePx must be a non-negative integer")
    if not isinstance(manifest.get("allowSafeAreaOverflow"), bool):
        errors.append("Manifest allowSafeAreaOverflow must be boolean")
    if not isinstance(manifest.get("overlays"), list):
        errors.append("Manifest overlays must be an array")


def validate_frame(
    path: Path,
    frame_index: int,
    contract: dict[str, Any],
    manifest: dict[str, Any],
    errors: list[str],
) -> None:
    if not path.exists():
        errors.append(f"missing frame {frame_index + 1}: {path.name}")
        return
    try:
        image = Image.open(path)
        image.load()
    except OSError as error:
        errors.append(f"Unreadable frame {path.name}: {error}")
        return

    width = int(contract["width"])
    height = int(contract["height"])
    if image.size != (width, height):
        errors.append(f"Frame {path.name} must be {width}x{height}, got {image.width}x{image.height}")
        return
    if image.mode != "RGBA":
        errors.append(f"Frame {path.name} must be RGBA, got {image.mode}")
        return

    alpha = image.getchannel("A")
    minimum_alpha, maximum_alpha = alpha.getextrema()
    if minimum_alpha != 0 or maximum_alpha == 0:
        errors.append(f"Frame {path.name} must contain visible foreground and transparent background")
        return
    bounds = alpha.point(lambda value: 255 if value > 10 else 0).getbbox()
    if bounds is None:
        errors.append(f"Frame {path.name} has no meaningful foreground")
        return

    if not manifest["allowSafeAreaOverflow"]:
        padding = int(contract["safePadding"])
        left, top, right, bottom = bounds
        if left < padding or top < padding or right > width - padding or bottom > height - padding:
            errors.append(f"Frame {path.name} foreground extends outside the {padding}px safe area")

    if frame_index in manifest["contactFrames"]:
        bottommost_pixel = bounds[3] - 1
        baseline = int(contract["groundBaselineY"])
        tolerance = int(manifest["baselineTolerancePx"])
        if abs(bottommost_pixel - baseline) > tolerance:
            errors.append(
                f"Frame {path.name} contact baseline is y={bottommost_pixel}; expected {baseline}±{tolerance}"
            )


def validate_action(manifest_path: Path) -> list[str]:
    errors: list[str] = []
    manifest = load_json(manifest_path, "action manifest", errors)
    if manifest is None:
        return errors
    validate_manifest_fields(manifest, errors)

    contract_value = manifest.get("canvasContract")
    if not isinstance(contract_value, str) or not contract_value:
        errors.append("Manifest canvasContract must be a non-empty relative path")
        return errors
    contract_path = (manifest_path.parent / contract_value).resolve()
    contract = load_json(contract_path, "canvas contract", errors)
    if contract is None:
        return errors
    if contract.get("schemaVersion") != 1:
        errors.append(f"Unsupported canvas contract schemaVersion: {contract.get('schemaVersion')}")

    required_contract_fields = ("width", "height", "safePadding", "groundBaselineY")
    if any(not isinstance(contract.get(field), int) for field in required_contract_fields):
        errors.append("Canvas contract is missing required integer geometry fields")
        return errors

    frame_count = manifest.get("frameCount")
    prefix = manifest.get("framePrefix")
    if not isinstance(frame_count, int) or frame_count <= 0 or not isinstance(prefix, str) or not prefix:
        return errors

    contact_frames = manifest.get("contactFrames")
    if isinstance(contact_frames, list):
        for frame_index in contact_frames:
            if not isinstance(frame_index, int) or frame_index < 0 or frame_index >= frame_count:
                errors.append(f"Invalid contact frame index: {frame_index}")

    if errors:
        return errors

    for frame_index in range(frame_count):
        frame_path = manifest_path.parent / f"{prefix}-{frame_index + 1:02d}.png"
        validate_frame(frame_path, frame_index, contract, manifest, errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Path to an action manifest.json")
    args = parser.parse_args()
    errors = validate_action(args.manifest.resolve())
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"PASS: {args.manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
