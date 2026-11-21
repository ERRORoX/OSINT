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

    def test_username_search_saves_findings_to_active_relationship_graph(self):
        script = (ROOT / "tools" / "username-workspace" / "frontend" / "js" / "username.js").read_text(encoding="utf-8")
        page = (ROOT / "tools" / "username-workspace" / "frontend" / "index.html").read_text(encoding="utf-8")
        styles = (ROOT / "tools" / "username-workspace" / "frontend" / "css" / "username.css").read_text(encoding="utf-8")
        self.assertIn("function buildUsernameGraphPayload(username, rows)", script)
        self.assertIn("async function persistUsernameGraph(username, rows)", script)
        self.assertIn('fetch("/api/graph/merge"', script)
        self.assertIn('id="usernameGraphStatus"', page)
        self.assertIn("searchInProgress", script)
        self.assertIn('.username-graph-status[data-state="success"]', styles)
        self.assertIn('username.js?v=4.2.10', page)

    def test_maigret_uses_managed_install_instead_of_broken_local_checkout(self):
        source = (ROOT / "tools" / "maigret" / "backend" / "tool.py").read_text(encoding="utf-8")
        self.assertIn("def _ensure_maigret", source)
        self.assertIn('"pip", "install"', source)
        self.assertIn('cwd=_ROOT', source)
        self.assertNotIn('cwd=run_cwd', source)
        defaults = ROOT / "tools" / "maigret" / "maigret" / "resources" / "settings.json"
        self.assertTrue(defaults.is_file(), "Maigret must ship a usable default settings.json")
        config = json.loads(defaults.read_text(encoding="utf-8"))
        self.assertEqual(config["sites_db_path"], "resources/data.json")
        self.assertIn("retries_count", config)
        self.assertIn("max_connections", config)

    def test_blackbird_installs_requirements_before_launch(self):
        source = (ROOT / "tools" / "blackbird" / "backend" / "tool.py").read_text(encoding="utf-8")
        self.assertIn("def _ensure_blackbird_dependencies", source)
        self.assertIn('"requirements.txt"', source)
        self.assertIn("ready, install_error = _ensure_blackbird_dependencies()", source)

    def test_username_page_has_compact_search_pipeline(self):
        page = (ROOT / "tools" / "username-workspace" / "frontend" / "index.html").read_text(encoding="utf-8")
        styles = (ROOT / "tools" / "username-workspace" / "frontend" / "css" / "username.css").read_text(encoding="utf-8")
        self.assertIn('class="username-overview"', page)
        self.assertIn(".username-overview__steps", styles)
        self.assertIn("username.js?v=4.2.10", page)

    def test_username_failed_tools_are_not_shown_as_100_percent_success(self):
        progress = (ROOT / "tools" / "username-workspace" / "frontend" / "js" / "progress.js").read_text(encoding="utf-8")
        page = (ROOT / "tools" / "username-workspace" / "frontend" / "index.html").read_text(encoding="utf-8")
        self.assertIn('pctEl.textContent = "ОШИБКА"', progress)
        self.assertIn("username.js?v=4.2.10", page)

    def test_username_frontend_uses_only_canonical_asset_paths(self):
        js = (ROOT / "tools" / "username-workspace" / "frontend" / "js" / "username.js").read_text(encoding="utf-8")
        self.assertNotIn("/username/js/", js)
        self.assertIn('import("./username-output.js")', js)
        self.assertIn("await rendererReady", js)

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
        self.assertIn('fetch(API+path', hub_source)
        self.assertIn('requestGraph("PUT",graphData)', hub_source)
        self.assertIn('requestGraph("POST",{name},"/investigations")', hub_source)
        self.assertIn('requestGraph("DELETE")', hub_source)

    def test_homepage_interactive_relationship_graph(self):
        page = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "js" / "app-hub.js").read_text(encoding="utf-8")
        styles = (ROOT / "static" / "css" / "hub-only.css").read_text(encoding="utf-8")
        self.assertIn('id="investigation-graph"', page)
        self.assertIn('id="graph-investigation-select"', page)
        self.assertIn('id="graph-save-investigation"', page)
        self.assertIn('id="graph-investigation-new"', page)
        self.assertIn('id="graph-import-button"', page)
        self.assertIn('function graphValidate(value)', script)
        self.assertIn('function graphWire()', script)
        self.assertIn('GRAPH_STORAGE_KEY="osint-panel-graph-data-v1"', script)
        self.assertNotIn('ДЕМО-ДАННЫЕ', page)
        self.assertNotIn('GRAPH_DEMO', script)
        self.assertIn('investigationDelete?.addEventListener', script)
        self.assertIn('.graph-node.is-selected', styles)
        self.assertIn('touch-action:none', styles)
        self.assertIn('id="graph-context-menu"', page)
        self.assertIn('id="graph-layout-mode"', page)
        self.assertIn('group.addEventListener("contextmenu"', script)
        self.assertIn('action==="neighbors"', script)
        self.assertIn('const GRAPH_TRANSFORMS=', script)
        self.assertIn('async function graphRunTransform(node,toolId)', script)
        self.assertIn('function graphExtractEntities(output,seed)', script)
        self.assertIn('"/tools/"+encodeURIComponent(toolId)+"/run"', script)
        self.assertIn('"/graph/merge"', script)
        self.assertIn('data-transform', script)
        self.assertIn('graph-context-section', styles)
        self.assertIn('function graphFocusNode(id)', script)
        self.assertIn('mode==="organic"', script)
        self.assertIn('mode==="circular"', script)
        self.assertIn('mode==="grid"', script)
        self.assertIn('"/modules/domain-search/"', script)
        self.assertIn('"/modules/ip-rdap/"', script)
        self.assertIn(".graph-context-menu", styles)
        self.assertIn(".graph-neighbor-list", styles)


    def test_domain_workspace_stylesheets_and_assets_are_well_formed(self):
        page = (ROOT / "tools" / "domain-workspace" / "frontend" / "index.html").read_text(encoding="utf-8")
        self.assertIn('<link rel="stylesheet" href="/css/unified-workstation.css?v=4.5.0">', page)
        self.assertIn('<link rel="stylesheet" href="/css/panel-42-dashboard.css?v=4.2.1">', page)
        self.assertNotIn('unified-workstation.css?v=4.5.0\\n', page)
        self.assertIn('src="./js/domain.js?v=4.2.20"', page)

    def test_domain_workspace_ignores_stale_requests_after_reset(self):
        script = (ROOT / "tools" / "domain-workspace" / "frontend" / "js" / "domain.js").read_text(encoding="utf-8")
        self.assertIn("let runSession = 0;", script)
        self.assertIn("if (session !== runSession) return;", script)
        self.assertIn("runSession += 1;", script)
        self.assertIn("const totalSelected = Math.max(1, selectedTools.size);", script)
        self.assertIn('doneSet.size + "/" + totalSelected + " завершено"', script)
        self.assertIn('(progress / totalSelected) * 100', script)
        self.assertIn('Math.round((progress / totalSelected) * 100)', script)


    def test_ip_registry_saves_successful_lookups_to_persistent_graph(self):
        page = (ROOT / "tools" / "ip-rdap" / "frontend" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "tools" / "ip-rdap" / "frontend" / "page.js").read_text(encoding="utf-8")
        self.assertIn('id="ip-graph-status"', page)
        self.assertIn('page.js?v=4.2.3', page)
        self.assertIn('fetch("/api/graph/merge"', script)
        self.assertIn('type: "ip"', script)
        self.assertIn('type: "organization"', script)
        self.assertIn('await saveToGraph(ip, lastOutput)', script)
        self.assertIn('currentRequest !== requestId', script)

    def test_ip_registry_page_has_accessible_loading_result_and_copy_controls(self):
        page = (ROOT / "tools" / "ip-rdap" / "frontend" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "tools" / "ip-rdap" / "frontend" / "page.js").read_text(encoding="utf-8")
        self.assertIn('aria-live="polite"', page)
        self.assertIn('id="ip-copy"', page)
        self.assertIn('button.disabled = true', script)
        self.assertIn('navigator.clipboard.writeText(lastOutput)', script)


    def test_settings_page_preserves_saved_api_keys_and_has_dependency_controls(self):
        script = (ROOT / "static" / "js" / "settings.js").read_text(encoding="utf-8")
        page = (ROOT / "static" / "p" / "settings" / "index.html").read_text(encoding="utf-8")
        styles = (ROOT / "static" / "css" / "tools" / "packs" / "settings" / "panel.css").read_text(encoding="utf-8")
        self.assertIn("if (v) payload[input.name] = v", script)
        self.assertIn("Пустое поле не должно стирать ранее сохранённый ключ", script)
        self.assertIn('id="btn-check-tools"', script)
        self.assertIn('id="btn-install-update"', script)
        self.assertIn('src="/p/settings/page.js"', page)
        self.assertIn(".settings-key-state.is-set", styles)

    def test_workspace_does_not_inject_sidebar_into_settings_or_module_pages(self):
        script = (ROOT / "static" / "js" / "workspace.js").read_text(encoding="utf-8")
        self.assertIn("Keep the compact top navigation. Do not create a sidebar", script)
        mount = script.split("function mount()", 1)[1]
        self.assertNotIn("ensureSidebarLayout();", mount)



    def test_username_layout_and_graphical_dependency_authorization(self):
        page = (ROOT / "tools" / "username-workspace" / "frontend" / "index.html").read_text(encoding="utf-8")
        styles = (ROOT / "tools" / "username-workspace" / "frontend" / "css" / "username.css").read_text(encoding="utf-8")
        manager = (ROOT / "backend" / "tool_manager.py").read_text(encoding="utf-8")
        settings = (ROOT / "static" / "js" / "settings.js").read_text(encoding="utf-8")
        self.assertIn("username.css?v=4.2.10", page)
        self.assertIn("#nav-tools.tab-nav", styles)
        self.assertIn("width: 100% !important", styles)
        self.assertIn('attempts.append(("pkexec", [pkexec, *command]))', manager)
        self.assertIn("системное окно подтверждения (Polkit)", settings)

    def test_username_result_review_filters_and_exports(self):
        page = (ROOT / "tools" / "username-workspace" / "frontend" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "tools" / "username-workspace" / "frontend" / "js" / "username.js").read_text(encoding="utf-8")
        styles = (ROOT / "tools" / "username-workspace" / "frontend" / "css" / "username.css").read_text(encoding="utf-8")
        self.assertIn('id="usernameResultSearch"', page)
        self.assertIn('id="usernameResultCategory"', page)
        self.assertIn('id="usernameResultSort"', page)
        self.assertIn('id="usernameExportJson"', page)
        self.assertIn('id="usernameExportCsv"', page)
        self.assertIn("function refreshUsernameResultControls()", script)
        self.assertIn("function downloadUsernameExport(format)", script)
        self.assertIn("function openUsernameProfileDetails(card)", script)
        self.assertIn("username-profile-dialog__panel", styles)
        self.assertIn("Не подтверждено", script)
        self.assertIn("Совпадения по username", script)
        self.assertIn(".username-results-tools__controls", styles)
        output = (ROOT / "tools" / "username-workspace" / "frontend" / "js" / "username-output.js").read_text(encoding="utf-8")
        verify = (ROOT / "tools" / "username-workspace" / "frontend" / "js" / "verify.js").read_text(encoding="utf-8")
        app = (ROOT / "backend" / "app.py").read_text(encoding="utf-8")
        self.assertIn("function isRootDomainUrl(url)", output)
        self.assertIn("data-verify-url=", output)
        self.assertIn("HTTP 200 only proves that a page responded", app)
        self.assertIn("soft_404_markers", app)
        self.assertIn("reachable_unconfirmed", app)
        self.assertIn("профиль не подтверждён", verify)
        self.assertIn("Не найден", verify)


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
