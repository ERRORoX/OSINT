"""Tests for cross-platform dependency installation."""
import unittest
from unittest.mock import patch

from backend import tool_manager


class ToolManagerTests(unittest.TestCase):
    def test_linux_package_names_are_mapped(self):
        manifest = {"dependencies": {"system": ["whois"]}}
        with patch.object(tool_manager, "_package_manager", return_value=("apt-get", "/usr/bin/apt-get", ["install", "-y"])):
            self.assertEqual(tool_manager._system_packages(manifest, "domain-search"), ["whois"])

    def test_manifest_system_dependencies_are_included(self):
        manifest = {
            "enabled": True,
            "status": "integrated",
            "name": "Example",
            "entrypoints": {"backend_adapter": "tools/example/backend/tool.py"},
            "dependencies": {"python": [], "system": ["nmap"]},
        }
        # Exercise the package mapping independently of the host's installed tools.
        with patch.object(tool_manager, "_package_manager", return_value=("apt-get", "/usr/bin/apt-get", ["install", "-y"])):
            self.assertEqual(tool_manager._system_packages(manifest, "example"), ["nmap"])

    def test_known_binary_packages_have_distribution_mappings(self):
        self.assertEqual(tool_manager.PACKAGE_NAMES["exiftool"]["apt"], "libimage-exiftool-perl")
        self.assertEqual(tool_manager.PACKAGE_NAMES["tesseract"]["apt"], "tesseract-ocr")
        self.assertIn("pacman", tool_manager.PACKAGE_NAMES["whois"])

    def test_settings_api_exposes_managed_install(self):
        from pathlib import Path
        root = Path(__file__).resolve().parents[2]
        source = (root / "backend" / "tool_manager.py").read_text(encoding="utf-8")
        self.assertIn("def _run_system_install", source)
        self.assertIn("pkexec", source)
        self.assertIn("sudo", source)


if __name__ == "__main__":
    unittest.main()
