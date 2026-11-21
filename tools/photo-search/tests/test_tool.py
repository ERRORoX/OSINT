"""Isolated contract tests for Photo Search."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from tools.tool_photo_search import ToolPhotoSearch


class PhotoSearchModuleTests(unittest.TestCase):
    def setUp(self):
        self.tool = ToolPhotoSearch()

    def test_tool_contract(self):
        self.assertEqual(self.tool.tool_id, "photo-search")

    def test_rejects_empty_image_without_network_access(self):
        result = self.tool.run({"image_base64": ""})
        self.assertFalse(result["success"])
        self.assertIn("изображение", result.get("error", "").lower())

    def test_rejects_invalid_image_without_network_access(self):
        result = self.tool.run({"image_base64": "not-an-image"})
        self.assertFalse(result["success"])


if __name__ == "__main__":
    unittest.main()
