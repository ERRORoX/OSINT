"""Static integration tests for migrated workspace frontends."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class ModuleFrontendTests(unittest.TestCase):
    def _manifest(self, module_id):
        path = ROOT / "tools" / module_id / "manifest.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def test_workspace_entrypoints_exist(self):
        module_ids = ("domain-workspace", "photo-workspace", "username-workspace", "grabcam", "ip-rdap", "google-osint", "ai-agent", "history")
        for module_id in module_ids:
            with self.subTest(module=module_id):
                manifest = self._manifest(module_id)
                frontend = ROOT / manifest["entrypoints"]["frontend"]
                self.assertTrue(frontend.is_file(), str(frontend))
                readme = manifest.get("entrypoints", {}).get("manifest_readme") or f"tools/{module_id}/README.md"
                self.assertTrue((ROOT / readme).is_file(), readme)

    def test_workspace_routes_are_registered(self):
        app_source = (ROOT / "backend" / "app.py").read_text(encoding="utf-8")
        for module_id in ("domain-workspace", "photo-workspace", "username-workspace", "grabcam", "ip-rdap", "google-osint", "ai-agent", "history"):
            with self.subTest(module=module_id):
                self.assertIn(f'@app.route("/modules/{module_id}/"', app_source)

    def test_legacy_page_urls_redirect_to_canonical_modules(self):
        app_source = (ROOT / "backend" / "app.py").read_text(encoding="utf-8")
        expected = {
            "domain-workspace": 'redirect("/modules/domain-workspace/"',
            "photo-workspace": 'redirect("/modules/photo-workspace/"',
            "username-workspace": 'redirect("/modules/username-workspace/"',
        }
        for module_id, snippet in expected.items():
            with self.subTest(module=module_id):
                self.assertIn(snippet, app_source)

        grabcam_legacy = (ROOT / "static" / "p" / "grabcam" / "index.html").read_text(encoding="utf-8")
        self.assertIn('/modules/grabcam/', grabcam_legacy)

        legacy_pages = {
            "grabcam": "static/p/grabcam/index.html",
            "ip-rdap": "static/p/ip-rdap/index.html",
            "google-osint": "static/p/google-osint/index.html",
            "ai-agent": "static/p/ai-agent/index.html",
            "history": "static/p/history/index.html",
        }
        for module_id, relative_path in legacy_pages.items():
            with self.subTest(module=module_id):
                legacy = (ROOT / relative_path).read_text(encoding="utf-8")
                self.assertIn(f"/modules/{module_id}/", legacy)

    def test_module_manager_uses_registry_api(self):
        page = (ROOT / "static" / "p" / "modules" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "p" / "modules" / "page.js").read_text(encoding="utf-8")
        self.assertIn('href="/p/modules/page.css"', page)
        self.assertIn('src="/p/modules/page.js"', page)
        self.assertIn('fetch("/api/modules"', script)
        self.assertIn("runtime_errors", script)

    def test_username_frontend_uses_only_canonical_asset_paths(self):
        js = (ROOT / "tools" / "username-workspace" / "frontend" / "js" / "username.js").read_text(encoding="utf-8")
        self.assertNotIn("/username/js/", js)
        self.assertIn("/modules/username-workspace/js/username-output.js", js)

    def test_grabcam_demo_requires_clicks_and_does_not_upload(self):
        demo = (ROOT / "tools" / "grabcam" / "demo" / "index.html").read_text(encoding="utf-8")
        self.assertIn('start.addEventListener("click"', demo)
        self.assertIn('document.getElementById("geo-request").addEventListener("click"', demo)
        for forbidden in ("fetch(", "XMLHttpRequest", "sendBeacon"):
            self.assertNotIn(forbidden, demo)


if __name__ == "__main__":
    unittest.main()
