from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "validate-ronin-action.py"
SPEC = importlib.util.spec_from_file_location("validate_ronin_action", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class RoninActionValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.action_dir = self.root / "idle-calm"
        self.action_dir.mkdir()
        self.contract_path = self.root / "canvas-contract.json"
        self.contract_path.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "width": 640,
                    "height": 640,
                    "rootAnchor": {"x": 320, "y": 390},
                    "groundBaselineY": 580,
                    "neutralHeadTopY": 72,
                    "safePadding": 32,
                    "displaySizePoints": 120,
                }
            )
        )
        self.manifest_path = self.action_dir / "manifest.json"
        self.write_manifest()
        self.write_frame(1)
        self.write_frame(2)

    def write_manifest(self, **overrides: object) -> None:
        manifest = {
            "schemaVersion": 1,
            "action": "idle-calm",
            "identityPackVersion": "animation-master-v1",
            "framePrefix": "ronin-idle-calm",
            "frameCount": 2,
            "intervalMs": 420,
            "loopMode": "loop",
            "canvasContract": "../canvas-contract.json",
            "contactFrames": [0, 1],
            "baselineTolerancePx": 3,
            "allowSafeAreaOverflow": False,
            "overlays": [],
        }
        manifest.update(overrides)
        self.manifest_path.write_text(json.dumps(manifest))

    def write_frame(
        self,
        number: int,
        *,
        size: tuple[int, int] = (640, 640),
        mode: str = "RGBA",
        bounds: tuple[int, int, int, int] = (200, 100, 440, 581),
    ) -> None:
        image = Image.new(mode, size, (0, 0, 0, 0) if mode == "RGBA" else (0, 0, 0))
        ImageDraw.Draw(image).rectangle(bounds, fill=(40, 50, 60, 255) if mode == "RGBA" else (40, 50, 60))
        image.save(self.action_dir / f"ronin-idle-calm-{number:02d}.png")

    def test_valid_action_passes(self) -> None:
        self.assertEqual(MODULE.validate_action(self.manifest_path), [])

    def test_wrong_dimensions_fail(self) -> None:
        self.write_frame(2, size=(512, 512), bounds=(200, 100, 440, 511))
        self.assertTrue(any("640x640" in error for error in MODULE.validate_action(self.manifest_path)))

    def test_wrong_frame_count_or_filename_gap_fails(self) -> None:
        (self.action_dir / "ronin-idle-calm-02.png").unlink()
        errors = MODULE.validate_action(self.manifest_path)
        self.assertTrue(any("missing frame" in error for error in errors))

    def test_opaque_background_fails(self) -> None:
        self.write_frame(2, mode="RGB")
        self.assertTrue(any("RGBA" in error for error in MODULE.validate_action(self.manifest_path)))

    def test_safe_area_overflow_fails_unless_declared(self) -> None:
        self.write_frame(2, bounds=(10, 100, 440, 581))
        self.assertTrue(any("safe area" in error for error in MODULE.validate_action(self.manifest_path)))
        self.write_manifest(allowSafeAreaOverflow=True)
        self.assertEqual(MODULE.validate_action(self.manifest_path), [])

    def test_contact_frame_outside_baseline_tolerance_fails(self) -> None:
        self.write_frame(2, bounds=(200, 100, 440, 560))
        self.assertTrue(any("baseline" in error for error in MODULE.validate_action(self.manifest_path)))

    def test_invalid_manifest_version_and_contract_path_fail(self) -> None:
        self.write_manifest(schemaVersion=2, canvasContract="missing.json")
        errors = MODULE.validate_action(self.manifest_path)
        self.assertTrue(any("schemaVersion" in error for error in errors))
        self.assertTrue(any("canvas contract" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
