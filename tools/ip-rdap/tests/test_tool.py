"""Tests for the canonical IP/RDAP module and its compatibility adapter."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from tools.tool_ip_rdap import ToolIPRDAP


class IP_RDAP_ModuleTests(unittest.TestCase):
    def setUp(self):
        self.tool = ToolIPRDAP()

    def test_tool_contract(self):
        self.assertEqual(self.tool.tool_id, "ip-rdap")
        self.assertEqual(self.tool.name, "IP / RDAP")

    def test_rejects_invalid_ip_without_network_access(self):
        result = self.tool.run({"ip": "not-an-ip"})
        self.assertFalse(result["success"])
        self.assertIn("корректный", result["error"])

    def test_rejects_private_ip_without_network_access(self):
        result = self.tool.run({"ip": "192.168.1.1"})
        self.assertFalse(result["success"])
        self.assertIn("публичные", result["error"])


if __name__ == "__main__":
    unittest.main()
