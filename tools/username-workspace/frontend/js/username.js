/**
 * Username entrypoint: тонкий boot + динамический импорт рендера карточек.
 */
import { TOOL_DEFS } from "./consts.js";
import { apiRun } from "./api.js";
import { wireUserMenu } from "./user-menu.js";
import { wireToolToggles, getEnabledTools } from "./toggles.js";
import { wireTabs, resetTabHits, setTabHit } from "./tabs.js";
import { setSummary, mergedLinkStats } from "./summary.js";
import { resetProgressPanel, showProgressPanel, progressCard, setProgressState } from "./progress.js";
import { setTabLoading, createTabRenderer } from "./render.js";

/** @type {null | ((el: Element, o: { tabId: string, output: string, success: boolean }) => void)} */
let renderUsernameTabPane = null;

const renderTabCard = createTabRenderer({ getRenderer: () => renderUsernameTabPane });

const SKIP_MSG =
  "Инструмент выключен в списке модулей выше. Отметьте его и нажмите «Запуск выбранных», чтобы выполнить.";

async function runAll(username) {
  const enabled = getEnabledTools();
  const enabledSet = new Set(enabled.map((t) => t.tab));

  resetTabHits();
  showProgressPanel(true);
  resetProgressPanel(enabledSet);

  for (const t of TOOL_DEFS) {
    if (!enabledSet.has(t.tab)) {
      renderTabCard(t.tab, t.title, SKIP_MSG, true);
      setTabHit(t.tab, 0);
    } else {
      setTabLoading(t.tab, t.title);
    }
  }

  if (enabled.length === 0) {
    setSummary({ uniqueUrls: 0, uniqueDomains: 0, scannedCount: 0, selectedTotal: 0, wallSeconds: 0 });
    return;
  }

  const wallT0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const rows = await Promise.all(
    enabled.map(async (t) => {
      const card = progressCard(t.tab);
      setProgressState(card, { mode: "running", status: "Запрос к API…" });

      try {
        const data = await apiRun(t.id, { username });
        const out = (data.output || data.error || "").trim() || "(нет вывода)";
        const ok = Boolean(data.success);
        const stats = data.stats || null;
        renderTabCard(t.tab, t.title, out, ok);
        setTabHit(t.tab, stats || { unique_hosts: 0 });
        const sec = stats && typeof stats.duration_ms === "number" ? stats.duration_ms / 1000 : 0;
        const doneLine = sec > 0 ? `Готово за ${sec.toFixed(sec >= 10 ? 1 : 2)} с` : "Готово";
        if (ok) {
          setProgressState(card, { mode: "done", pct: 100, status: doneLine });
        } else {
          const errLine =
            sec > 0 ? `Через ${sec.toFixed(sec >= 10 ? 1 : 2)} с — неуспешное завершение` : "Завершено с ошибкой";
          setProgressState(card, { mode: "error", pct: 100, status: errLine });
        }
        return { ok, out, stats };
      } catch (e) {
        renderTabCard(t.tab, t.title, e.message || "Ошибка", false);
        setTabHit(t.tab, 0);
        setProgressState(card, { mode: "error", pct: 100, status: "Ошибка" });
        return { ok: false, out: "", stats: null };
      }
    })
  );

  const wallMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - wallT0;
  const wallSeconds = wallMs / 1000;

  const okTools = rows.filter((r) => r.ok).length;
  const merged = mergedLinkStats(rows.map((r) => r.out));

  setSummary({
    uniqueUrls: merged.uniqueUrls,
    uniqueDomains: merged.uniqueDomains,
    scannedCount: okTools,
    selectedTotal: enabled.length,
    wallSeconds,
  });
}

function wireSearch() {
  const btn = document.getElementById("searchBtn");
  const input = document.getElementById("searchInput");
  if (!btn || !input) return;

  async function go() {
    const q = (input.value || "").trim();
    if (!q) {
      input.focus();
      alert("Введите никнейм или имя для поиска.");
      return;
    }

    if (getEnabledTools().length === 0) {
      alert("Включите хотя бы один модуль (Sherlock, Maigret, Social Analyzer или Blackbird).");
      return;
    }

    const empty = document.getElementById("emptyState");
    const results = document.getElementById("resultsSection");
    if (empty) empty.style.display = "none";
    if (results) results.style.display = "block";

    document.querySelectorAll(".tab-btn").forEach((b) => (b.className = "tab-btn"));
    const sherBtn = document.querySelector('.tab-btn[data-tab="sherlock"]');
    if (sherBtn) sherBtn.classList.add("active-cyan");
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("visible"));
    document.getElementById("tab-sherlock")?.classList.add("visible");

    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    try {
      await runAll(q);
    } finally {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  }

  btn.addEventListener("click", () => void go());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void go();
    }
  });
}

function boot() {
  wireUserMenu();
  wireToolToggles();
  wireTabs();
  wireSearch();
}

boot();

import("/username/js/username-output.js")
  .then((m) => {
    if (m && typeof m.renderUsernameTabPane === "function") {
      renderUsernameTabPane = m.renderUsernameTabPane;
    }
  })
  .catch((err) => {
    console.warn("[username] Карточки по ссылкам недоступны, используется текстовый вывод.", err);
  });
