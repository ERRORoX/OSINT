"""Isolated tests for the canonical Domain Search module."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from tools.tool_domain_search import ToolDomainSearch, _MODULE
from modules import DomainSearch, run_domain_search


class DomainSearchModuleTests(unittest.TestCase):
    def setUp(self):
        self.tool = ToolDomainSearch()

    def test_tool_contract(self):
        self.assertEqual(self.tool.tool_id, "domain-search")

    def test_rejects_invalid_domain_without_network_access(self):
        result = self.tool.run({"domain": "not-a-domain"})
        self.assertFalse(result["success"])
        self.assertTrue(result.get("error"))

    def test_legacy_modules_import_is_preserved(self):
        self.assertTrue(DomainSearch)
        self.assertTrue(run_domain_search)

    def test_normalizes_domain(self):
        self.assertEqual(
            _MODULE.DOMAIN_MODULE._normalize_domain("https://www.example.com/path"),
            "example.com",
        )


if __name__ == "__main__":
    unittest.main()
