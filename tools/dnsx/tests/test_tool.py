"""Isolated tests for the dnsx module."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from tools.tool_dnsx import ToolDnsx


class DnsxModuleTests(unittest.TestCase):
    def setUp(self):
        self.tool = ToolDnsx()

    def test_tool_contract(self):
        self.assertEqual(self.tool.tool_id, "dnsx")

    def test_rejects_invalid_domain_without_running_binary(self):
        result = self.tool.run({"domain": "invalid"})
        self.assertFalse(result["success"])
        self.assertIn("домен", result.get("error", "").lower())

    def test_normalizes_domain(self):
        normalizer = self.tool.__class__.__module__
        module = sys.modules[normalizer]
        self.assertEqual(module._normalize_domain("https://www.example.com/path"), "example.com")


if __name__ == "__main__":
    unittest.main()
