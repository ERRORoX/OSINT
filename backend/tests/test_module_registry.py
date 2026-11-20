"""Unit tests for the read-only module registry."""
import json
import tempfile
import unittest
from pathlib import Path

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
            "version": "1.0.0",
            "category": "utility",
            "status": "legacy",
            "enabled": True,
            "entrypoints": {},
        }

    def test_discovers_valid_manifest(self):
        temp, root = self._project(self._manifest())
        self.addCleanup(temp.cleanup)
        result = discover_modules(root)
        self.assertEqual(result["summary"]["discovered"], 1)
        self.assertEqual(result["summary"]["valid"], 1)
        self.assertEqual(result["modules"][0]["id"], "sample")

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

    def test_bad_json_is_reported_not_executed(self):
        temp, root = self._project(self._manifest())
        self.addCleanup(temp.cleanup)
        manifest = root / "tools" / "sample" / "manifest.json"
        manifest.write_text("{broken", encoding="utf-8")
        result = discover_modules(root)
        self.assertEqual(result["summary"]["invalid"], 1)
        self.assertIn("manifest_read_error", {i["code"] for i in result["modules"][0]["issues"]})


if __name__ == "__main__":
    unittest.main()
