"""Unit tests for the read-only module registry."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from module_registry import discover_modules


class ModuleRegistryTests(unittest.TestCase):
    def _project(self, manifest):
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        module = root / "tools" / "sample"
        module.mkdir(parents=True)
        (module / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        return temp, root

    def _manifest(self):
        return {
            "schema_version": 1,
            "id": "sample",
            "name": "Sample",
            "description": "A sample module description.",
            "version": "1.0.0",
            "category": "utility",
            "status": "legacy",
            "enabled": True,
            "entrypoints": {},
        }

    def test_discovers_valid_manifest_and_exposes_description(self):
        temp, root = self._project(self._manifest())
        self.addCleanup(temp.cleanup)
        result = discover_modules(root)
        self.assertEqual(result["summary"]["discovered"], 1)
        self.assertEqual(result["summary"]["valid"], 1)
        self.assertEqual(result["modules"][0]["id"], "sample")
        self.assertEqual(result["modules"][0]["description"], "A sample module description.")

    def test_rejects_directory_id_mismatch(self):
        temp, root = self._project({**self._manifest(), "id": "other"})
        self.addCleanup(temp.cleanup)
        result = discover_modules(root)
        self.assertFalse(result["modules"][0]["valid"])
        self.assertIn("directory_id_mismatch", {i["code"] for i in result["modules"][0]["issues"]})

    def test_rejects_path_traversal(self):
        temp, root = self._project({
            **self._manifest(),
            "entrypoints": {"frontend": "../outside.js"},
        })
        self.addCleanup(temp.cleanup)
        result = discover_modules(root)
        self.assertFalse(result["modules"][0]["valid"])
        self.assertIn("unsafe_entrypoint", {i["code"] for i in result["modules"][0]["issues"]})

    def test_rejects_windows_style_path_traversal(self):
        temp, root = self._project({
            **self._manifest(),
            "entrypoints": {"frontend": r"..\outside.js"},
        })
        self.addCleanup(temp.cleanup)
        result = discover_modules(root)
        self.assertFalse(result["modules"][0]["valid"])
        self.assertIn("unsafe_entrypoint", {i["code"] for i in result["modules"][0]["issues"]})

    def test_rejects_windows_absolute_path(self):
        temp, root = self._project({
            **self._manifest(),
            "legacy_paths": [r"C:\outside\module.py"],
        })
        self.addCleanup(temp.cleanup)
        result = discover_modules(root)
        self.assertFalse(result["modules"][0]["valid"])
        self.assertIn("unsafe_legacy_path", {i["code"] for i in result["modules"][0]["issues"]})

    def test_rejects_symlinked_module_directory_outside_tools(self):
        temp, root = self._project(self._manifest())
        self.addCleanup(temp.cleanup)
        tools_dir = root / "tools"
        outside = root / "outside"
        outside.mkdir()
        (outside / "manifest.json").write_text(json.dumps(self._manifest()), encoding="utf-8")
        link = tools_dir / "linked"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("Symlink creation is not supported on this platform")
        result = discover_modules(root)
        self.assertEqual(result["summary"]["discovered"], 1)
        self.assertNotIn("linked", {m["id"] for m in result["modules"]})

    def test_rejects_manifest_symlink_outside_module(self):
        temp, root = self._project(self._manifest())
        self.addCleanup(temp.cleanup)
        module = root / "tools" / "sample"
        outside = root / "outside.json"
        outside.write_text(json.dumps(self._manifest()), encoding="utf-8")
        manifest = module / "manifest.json"
        manifest.unlink()
        try:
            manifest.symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("Symlink creation is not supported on this platform")
        result = discover_modules(root)
        self.assertEqual(result["summary"]["discovered"], 0)

    def test_bad_json_is_reported_not_executed(self):
        temp, root = self._project(self._manifest())
        self.addCleanup(temp.cleanup)
        manifest = root / "tools" / "sample" / "manifest.json"
        manifest.write_text("{broken", encoding="utf-8")
        result = discover_modules(root)
        self.assertEqual(result["summary"]["invalid"], 1)
        self.assertIn("manifest_read_error", {i["code"] for i in result["modules"][0]["issues"]})

    def test_disabled_module_is_not_counted_as_enabled(self):
        temp, root = self._project({**self._manifest(), "enabled": False})
        self.addCleanup(temp.cleanup)
        result = discover_modules(root)
        self.assertEqual(result["summary"]["enabled"], 0)
        self.assertFalse(result["modules"][0]["enabled"])


if __name__ == "__main__":
    unittest.main()
