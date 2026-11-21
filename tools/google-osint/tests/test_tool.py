"""Isolated contract tests for Google OSINT."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

from tools.tool_google_osint import ToolGoogleOsint


class GoogleOsintModuleTests(unittest.TestCase):
    def setUp(self):
        self.tool = ToolGoogleOsint()

    def test_tool_contract(self):
        self.assertEqual(self.tool.tool_id, "google-osint")

    def test_rejects_invalid_email_before_loading_helpers(self):
        result = self.tool.run({"email": "not-an-email"})
        self.assertFalse(result["success"])
        self.assertIn("email", result.get("error", "").lower())

    def test_requires_at_least_one_helper(self):
        result = self.tool.run({"email": "user@example.com", "run_holehe": False, "run_h8mail": False})
        self.assertFalse(result["success"])
        self.assertIn("включите", result.get("error", "").lower())


if __name__ == "__main__":
    unittest.main()
