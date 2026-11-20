"""Tests for controlled loading of integrated modules."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from module_runtime import load_integrated_tools
from tools.base import ToolBase


class ModuleRuntimeTests(unittest.TestCase):
    def _project(self, status="integrated", backend_path="tools/sample/backend/tool.py", tool_class="SampleTool", source=None):
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        module = root / "tools" / "sample"
        backend = module / "backend"
        backend.mkdir(parents=True)
        (root / "tools" / "sample" / "manifest.json").write_text(json.dumps({
            "schema_version": 1,
            "id": "sample",
            "name": "Sample",
            "version": "1.0.0",
            "category": "utility",
            "status": status,
            "enabled": True,
            "entrypoints": {
                "backend_adapter": backend_path,
                "tool_class": tool_class
            }
        }), encoding="utf-8")
        if source is not None:
            target = root / backend_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(source, encoding="utf-8")
        return temp, root

    def _tool_source(self):
        return (
            "from tools.base import ToolBase\n"
            "class SampleTool(ToolBase):\n"
            "    @property\n"
            "    def tool_id(self): return 'sample'\n"
            "    @property\n"
            "    def name(self): return 'Sample'\n"
            "    def run(self, params): return {'success': True, 'output': 'ok'}\n"
        )

    def test_loads_only_valid_integrated_tool(self):
        temp, root = self._project(source=self._tool_source())
        self.addCleanup(temp.cleanup)
        loaded, issues = load_integrated_tools(root)
        self.assertEqual([tool.tool_id for tool in loaded], ["sample"])
        self.assertEqual(issues, [])

    def test_skips_legacy_modules(self):
        temp, root = self._project(status="legacy", source=self._tool_source())
        self.addCleanup(temp.cleanup)
        loaded, issues = load_integrated_tools(root)
        self.assertEqual(loaded, [])
        self.assertEqual(issues, [])

    def test_rejects_noncanonical_backend_path(self):
        temp, root = self._project(backend_path="backend/unsafe.py", source=self._tool_source())
        self.addCleanup(temp.cleanup)
        loaded, issues = load_integrated_tools(root)
        self.assertEqual(loaded, [])
        self.assertEqual(issues[0]["code"], "noncanonical_runtime_path")

    def test_reports_invalid_tool_class(self):
        temp, root = self._project(tool_class="NotAClass", source=self._tool_source())
        self.addCleanup(temp.cleanup)
        loaded, issues = load_integrated_tools(root)
        self.assertEqual(loaded, [])
        self.assertEqual(issues[0]["code"], "runtime_load_error")


if __name__ == "__main__":
    unittest.main()
