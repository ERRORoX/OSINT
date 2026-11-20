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

    def test_demo_assets_are_inside_module(self):
        module_root = ROOT / "tools" / "grabcam"
        self.assertTrue((module_root / "demo" / "index.html").is_file())
        self.assertTrue((module_root / "panel" / "js" / "tool-grabcam.js").is_file())


if __name__ == "__main__":
    unittest.main()
