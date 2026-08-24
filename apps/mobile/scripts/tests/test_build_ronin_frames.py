from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "build-ronin-walk-cycle-frames.py"
SPEC = importlib.util.spec_from_file_location("build_ronin_frames", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class FixedCanvasFrameTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
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

    def test_fixed_canvas_preserves_source_coordinates(self) -> None:
        sheet = np.zeros((640, 1280, 4), dtype=np.uint8)
        sheet[100:180, 120:220] = [40, 50, 60, 255]
        sheet[240:360, 640 + 300 : 640 + 390] = [70, 80, 90, 255]

        contract = MODULE.load_canvas_contract(self.contract_path)
        frames = MODULE.build_fixed_frames(
            sheet,
            contract,
            frame_count=2,
            cell_width=640,
            already_alpha=True,
            allow_safe_area_overflow=False,
        )

        self.assertEqual(len(frames), 2)
        self.assertEqual(frames[0].size, (640, 640))
        self.assertEqual(frames[1].size, (640, 640))
        self.assertEqual(frames[0].getchannel("A").getbbox(), (120, 100, 220, 180))
        self.assertEqual(frames[1].getchannel("A").getbbox(), (300, 240, 390, 360))

    def test_fixed_canvas_rejects_out_of_bounds_foreground(self) -> None:
        sheet = np.zeros((640, 640, 4), dtype=np.uint8)
        sheet[100:180, 10:80] = [40, 50, 60, 255]

        contract = MODULE.load_canvas_contract(self.contract_path)
        with self.assertRaisesRegex(ValueError, "safe area"):
            MODULE.build_fixed_frames(
                sheet,
                contract,
                frame_count=1,
                cell_width=640,
                already_alpha=True,
                allow_safe_area_overflow=False,
            )

    def test_legacy_mode_still_uses_shared_auto_sized_canvas(self) -> None:
        rgb = np.full((240, 500, 3), MODULE.GREEN_KEY, dtype=np.uint8)
        rgb[40:180, 50:130] = [80, 50, 30]
        rgb[20:200, 320:420] = [90, 60, 40]
        mask = MODULE.foreground_mask(rgb)
        entries, _ = MODULE.find_character_boxes(mask, frame_count=2)

        max_dim = MODULE.calculate_legacy_canvas_size(entries)

        self.assertEqual(max_dim, 228)


if __name__ == "__main__":
    unittest.main()
