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


    def test_home_navigation_is_manifest_driven(self):
        app_source = (ROOT / "backend" / "app.py").read_text(encoding="utf-8")
        hub_source = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        self.assertIn('@app.route("/api/navigation", methods=["GET"])', app_source)
        self.assertIn("get_navigation_modules(_PROJECT_ROOT)", app_source)
        self.assertIn('registered_routes = {rule.rule for rule in app.url_map.iter_rules()}', app_source)
        self.assertIn('if module["href"] in registered_routes', app_source)
        self.assertIn('fetch(API+"/navigation"', hub_source)
        self.assertIn("applyNavigationModules(loadedNavigation)", hub_source)
        self.assertIn('pageById.get("domain-workspace")', hub_source)

    def test_module_manager_explains_read_only_manifest_controls(self):
        page = (ROOT / "static" / "p" / "modules" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Поле enabled в manifest управляет загрузкой", page)
        self.assertIn("через веб-интерфейс пока не поддерживается", page)

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

    def test_homepage_uses_full_width_layout_without_sidebar(self):
        page = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        styles = (ROOT / "static" / "css" / "hub-only.css").read_text(encoding="utf-8")
        self.assertNotIn('<aside class="sidebar">', page)
        self.assertNotIn('id="sidebar-toggle"', page)
        self.assertNotIn('function wireSidebar()', script)
        self.assertIn('id="btn-check-updates"', page)
        self.assertIn('id="update-status"', page)
        self.assertIn('.dashboard-shell{display:block!important', styles)
        self.assertIn('@media(max-width:680px)', styles)

    def test_homepage_uses_professional_dashboard_layer(self):
        page = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        dashboard_css = ROOT / "static" / "css" / "hub-only.css"
        hub_script = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        self.assertTrue(dashboard_css.is_file())
        self.assertIn("/css/hub-only.css", page)
        self.assertIn('class="investigation-hero"', page)
        self.assertIn('class="relationship-graph interactive-relationship-graph"', page)
        self.assertIn('id="investigation-graph"', page)
        self.assertIn('id="metric-tools"', page)
        self.assertIn('id="metric-sections"', page)
        self.assertIn('id="metric-categories"', page)
        self.assertIn('document.getElementById("metric-tools")', hub_script)
        self.assertIn('document.getElementById("backend-state")', hub_script)
        self.assertIn('Promise.allSettled', hub_script)



    def test_saved_material_archive_controls(self):
        page = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        styles = (ROOT / "static" / "css" / "hub-only.css").read_text(encoding="utf-8")
        self.assertIn('id="saved-materials-export"', page)
        self.assertIn('link.download="osint-panel-materials-', script)
        self.assertIn('data-saved-index', script)
        self.assertIn('saved-material-source-link', styles)

    def test_home_saved_material_search(self):
        page = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        styles = (ROOT / "static" / "css" / "hub-only.css").read_text(encoding="utf-8")
        self.assertIn('id="saved-materials-search"', page)
        self.assertIn('addEventListener("input",renderSavedMaterials)', script)
        self.assertIn('function renderSavedMaterials()', script)
        self.assertIn('data-saved-index', script)
        self.assertIn('.saved-materials-search input:focus', styles)

    def test_local_investigation_case_workspace(self):
        page = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        styles = (ROOT / "static" / "css" / "hub-only.css").read_text(encoding="utf-8")
        self.assertIn('id="case-project-form"', page)
        self.assertIn('id="case-project-list"', page)
        self.assertIn('const CASE_PROJECTS_KEY="osint-panel-cases-v1"', script)
        self.assertIn("function wireCaseProjects()", script)
        self.assertIn("project.materialIds.push(selected)", script)
        self.assertIn("projects:readCaseProjects()", script)
        self.assertIn(".case-project-card", styles)


    def test_domain_analysis_persists_real_results_to_graph(self):
        domain_script = (ROOT / "tools" / "domain-workspace" / "frontend" / "js" / "domain.js").read_text(encoding="utf-8")
        self.assertIn("function buildDomainGraphPayload(rep)", domain_script)
        self.assertIn('fetch(API + "/graph/merge"', domain_script)
        self.assertIn("await persistReportToGraph(lastReport)", domain_script)
        self.assertIn("Карта связей обновлена", domain_script)
        self.assertIn("if (!successfulTools.length) return { nodes, edges };", domain_script)

    def test_relationship_graph_uses_server_sqlite_api(self):
        app_source = (ROOT / "backend" / "app.py").read_text(encoding="utf-8")
        store_source = (ROOT / "backend" / "db" / "graph_store.py").read_text(encoding="utf-8")
        hub_source = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        self.assertIn('@app.route("/api/graph", methods=["GET", "PUT", "DELETE"])', app_source)
        self.assertIn('@app.route("/api/graph/merge", methods=["POST"])', app_source)
        self.assertIn("CREATE TABLE IF NOT EXISTS relationship_graph", store_source)
        self.assertIn('fetch(API+"/graph"', hub_source)
        self.assertIn('requestGraph("POST",graphData,"/graph/merge")', hub_source)
        self.assertIn('requestGraph("DELETE")', hub_source)

    def test_homepage_interactive_relationship_graph(self):
        page = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        styles = (ROOT / "static" / "css" / "hub-only.css").read_text(encoding="utf-8")
        self.assertIn('id="investigation-graph"', page)
        self.assertIn('id="graph-dataset-mode"', page)
        self.assertIn('id="graph-import-button"', page)
        self.assertIn('function graphValidate(value)', script)
        self.assertIn('function graphWire()', script)
        self.assertIn('GRAPH_STORAGE_KEY="osint-panel-graph-data-v1"', script)
        self.assertIn('ДЕМО-ДАННЫЕ', script)
        self.assertIn('.graph-node.is-selected', styles)
        self.assertIn('touch-action:none', styles)

if __name__ == "__main__":
    unittest.main()

    def test_saved_material_archive_controls(self):
        page = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        styles = (ROOT / "static" / "css" / "hub-only.css").read_text(encoding="utf-8")
        self.assertIn('id="saved-materials-export"', page)
        self.assertIn('link.download="osint-panel-materials-', script)
        self.assertIn('data-saved-index', script)
        self.assertIn('saved-material-source-link', styles)
