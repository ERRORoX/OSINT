"""Isolated contract tests for the safe GrabCam demo server adapter."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from tools.tool_grabcam import ToolGrabcam


class GrabCamModuleTests(unittest.TestCase):
    def test_tool_contract(self):
        tool = ToolGrabcam()
        self.assertEqual(tool.tool_id, "grabcam")
        self.assertTrue(tool.name.lower().startswith("grab"))

    def test_demo_requires_explicit_actions_and_never_uploads_capture_data(self):
        demo = (ROOT / "tools" / "grabcam" / "demo" / "index.html").read_text(encoding="utf-8")
        self.assertIn('start.addEventListener("click"', demo)
        self.assertIn('document.getElementById("geo-request").addEventListener("click"', demo)
        for forbidden in ("fetch(", "XMLHttpRequest", "sendBeacon"):
            self.assertNotIn(forbidden, demo)

    def test_demo_assets_are_inside_module(self):
        module_root = ROOT / "tools" / "grabcam"
        self.assertTrue((module_root / "demo" / "index.html").is_file())
        self.assertTrue((module_root / "panel" / "js" / "tool-grabcam.js").is_file())


if __name__ == "__main__":
    unittest.main()
