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
        normalize = _MODULE.DOMAIN_MODULE._normalize_domain
        self.assertEqual(normalize("https://www.example.com/path"), "example.com")
        self.assertEqual(normalize("example.com:8443/path?x=1"), "example.com")
        self.assertEqual(normalize("example.com?ref=campaign"), "example.com")
        self.assertEqual(normalize("https://пример.рф/"), "xn--e1afmkfd.xn--p1ai")
        self.assertEqual(normalize("not a valid host"), "")

    def test_rejects_ip_and_malformed_hostnames(self):
        validate = _MODULE.DOMAIN_MODULE._validate_domain
        for value in ("127.0.0.1", "example..com", "-bad.example", "bad-.example", "example.c"):
            with self.subTest(value=value):
                self.assertFalse(validate(value)[0])

    def test_accepts_normalized_url_and_idn_domain(self):
        validate = _MODULE.DOMAIN_MODULE._validate_domain
        self.assertTrue(validate("https://www.example.com:443/path")[0])
        self.assertTrue(validate("пример.рф")[0])


if __name__ == "__main__":
    unittest.main()
