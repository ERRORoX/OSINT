"""Isolated contract tests for the Shodan integration."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from tools.tool_shodan import ToolShodan


class ShodanModuleTests(unittest.TestCase):
    def test_tool_contract(self):
        tool = ToolShodan()
        self.assertEqual(tool.tool_id, "shodan")
        self.assertEqual(tool.name, "Shodan")


if __name__ == "__main__":
    unittest.main()
