"""Tests for safe module scaffolding."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import module_cli


class ModuleScaffoldingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.patch = patch.object(module_cli, "PROJECT_ROOT", self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.addCleanup(self.temp.cleanup)

    def test_creates_disabled_module_skeleton(self):
        target = module_cli.create_module("sample-tool", "Sample Tool", "other")
        manifest = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["id"], "sample-tool")
        self.assertEqual(manifest["status"], "planned")
        self.assertFalse(manifest["enabled"])
        for folder in ("frontend", "backend", "config", "tests"):
            self.assertTrue((target / folder).is_dir())
        self.assertTrue((target / "README.md").is_file())

    def test_rejects_path_traversal_id(self):
        with self.assertRaises(ValueError):
            module_cli.create_module("../outside", "Outside", "other")
        self.assertFalse((self.root.parent / "outside").exists())

    def test_refuses_to_overwrite_existing_module(self):
        module_cli.create_module("sample-tool", "Sample Tool", "other")
        readme = self.root / "tools" / "sample-tool" / "README.md"
        readme.write_text("keep", encoding="utf-8")
        with self.assertRaises(FileExistsError):
            module_cli.create_module("sample-tool", "Replacement", "other")
        self.assertEqual(readme.read_text(encoding="utf-8"), "keep")

    def test_rejects_tools_directory_symlink_outside_project(self):
        outside = self.root.parent / (self.root.name + "-outside")
        outside.mkdir()
        self.addCleanup(outside.rmdir)
        tools_link = self.root / "tools"
        try:
            tools_link.symlink_to(outside, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("Symlink creation is not supported on this platform")
        with self.assertRaises(ValueError):
            module_cli.create_module("sample-tool", "Sample Tool", "other")
        self.assertFalse((outside / "sample-tool").exists())


if __name__ == "__main__":
    unittest.main()
