"""Isolated contract tests for Blackbird."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from tools.tool_blackbird import ToolBlackbird


class BlackbirdModuleTests(unittest.TestCase):
    def setUp(self):
        self.tool = ToolBlackbird()

    def test_tool_contract(self):
        self.assertEqual(self.tool.tool_id, "blackbird")

    def test_rejects_missing_username_without_external_process(self):
        result = self.tool.run({"username": ""})
        self.assertFalse(result["success"])
        self.assertIn("имя пользователя", result.get("error", "").lower())

    def test_rejects_whitespace_username_without_external_process(self):
        result = self.tool.run({"username": "two words"})
        self.assertFalse(result["success"])
        self.assertIn("пробел", result.get("error", "").lower())


if __name__ == "__main__":
    unittest.main()
