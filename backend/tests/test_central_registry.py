"""End-to-end test for the central registry's manifest-driven runtime."""
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from tools import get_all_tools
from tools.registry import TOOLS


class CentralRegistryTests(unittest.TestCase):
    def test_all_expected_tool_ids_are_registered(self):
        expected = {
            "anonsms", "instagram-bruter", "grabcam", "photo-search", "google-osint",
            "theharvester", "domain-search", "sherlock", "maigret", "subfinder",
            "dnsx", "social-analyzer", "blackbird", "shodan", "ip-rdap", "phone-lookup", "phone-lookup",
        }
        actual = {tool.tool_id for tool in TOOLS}
        self.assertEqual(actual, expected)
        self.assertEqual(len(get_all_tools()), len(expected))

    def test_integrated_modules_are_loaded_from_manifest_runtime(self):
        integrated = {
            "grabcam", "photo-search", "google-osint", "theharvester", "domain-search",
            "sherlock", "maigret", "subfinder", "dnsx", "social-analyzer",
            "blackbird", "shodan", "ip-rdap",
        }
        tools = {tool.tool_id: tool for tool in TOOLS}
        for tool_id in integrated:
            with self.subTest(tool=tool_id):
                self.assertTrue(
                    tools[tool_id].__class__.__module__.startswith("_osint_runtime_"),
                    f"{tool_id} did not load from the manifest runtime",
                )

    def test_only_unmigrated_tools_remain_in_legacy_registry(self):
        tools = {tool.tool_id: tool for tool in TOOLS}
        self.assertEqual(
            {tool_id for tool_id, tool in tools.items() if not tool.__class__.__module__.startswith("_osint_runtime_")},
            {"anonsms", "instagram-bruter"},
        )


if __name__ == "__main__":
    unittest.main()
