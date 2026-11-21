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

// Wait for the rich result renderer before starting a search. This avoids
// rendering the first result in the fallback layout during a fast first click.
const rendererReady = import("./username-output.js")
  .then((m) => {
    if (m && typeof m.renderUsernameTabPane === "function") {
      renderUsernameTabPane = m.renderUsernameTabPane;
    }
  })
  .catch((err) => {
    console.warn("[username] Рендер карточек недоступен; используется безопасный текстовый вывод.", err);
  });

const renderTabCard = createTabRenderer({ getRenderer: () => renderUsernameTabPane });

const SKIP_MSG =
  "Инструмент выключен в списке модулей выше. Отметьте его и нажмите «Запуск выбранных», чтобы выполнить.";

function graphStableId(type, value) {
  let hash = 2166136261;
  const source = String(value || "").trim().toLowerCase();
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return type + ":" + (hash >>> 0).toString(16).padStart(8, "0");
}

function buildUsernameGraphPayload(username, rows) {
  const successful = (rows || []).filter((row) => row && row.ok);
  if (!successful.length) return { nodes: [], edges: [] };
  const nodes = [], edges = [], known = new Set();
  const addNode = (type, label, details) => {
    const clean = String(label || "").trim().slice(0, 180);
    if (!clean) return null;
    const id = graphStableId(type, clean);
    if (!known.has(id)) {
      known.add(id);
      nodes.push({ id, type, label: clean, details: String(details || "").slice(0, 1200) });
    }
    return id;
  };
  const addEdge = (source, target, label) => {
    if (!source || !target || source === target) return;
    if (!edges.some((edge) => edge.source === source && edge.target === target && edge.label === label)) edges.push({ source, target, label });
  };
  const sourceNames = successful.map((row) => row.toolName || row.toolId).filter(Boolean);
  const provenance = "Username OSINT · Источники: " + sourceNames.join(", ");
  const personId = addNode("person", username, provenance);
  const mergedOutput = successful.map((row) => row.out || "").join("\n");
  const hosts = new Set();
  for (const match of mergedOutput.matchAll(/https?:\/\/[^\s<>"'\])}]+/gi)) {
    try {
      const host = new URL(match[0]).hostname.toLowerCase().replace(/^www\./, "");
      if (host && host.includes(".") && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) hosts.add(host);
    } catch (_) {}
  }
  hosts.forEach((host) => {
    const id = addNode("domain", host, "Публичный профиль найден при поиске " + username + ". " + provenance);
    addEdge(personId, id, "профиль на платформе");
  });
  const emails = new Set(mergedOutput.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []);
  emails.forEach((email) => {
    const id = addNode("email", email.toLowerCase(), "Email обнаружен в результатах поиска " + username + ". " + provenance);
    addEdge(personId, id, "email в результатах");
  });
  const ips = new Set(mergedOutput.match(/(?<![\w.])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?![\w.])/g) || []);
  ips.forEach((ip) => {
    const id = addNode("ip", ip, "IP обнаружен в результатах поиска " + username + ". " + provenance);
    addEdge(personId, id, "IP в результатах");
  });
  return { nodes, edges };
}

async function persistUsernameGraph(username, rows) {
  const graph = buildUsernameGraphPayload(username, rows);
  if (!graph.nodes.length) return { nodes: 0, edges: 0 };
  const response = await fetch("/api/graph/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(graph),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Не удалось сохранить результаты в граф.");
  return { nodes: graph.nodes.length, edges: graph.edges.length };
}

async function runAll(username) {
  await rendererReady;
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
        return { toolId: t.id, toolName: t.title, ok, out, stats };
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
  const graphStatus = document.getElementById("usernameGraphStatus");
  if (graphStatus) {
    if (!okTools) {
      graphStatus.textContent = "В граф ничего не добавлено: нет успешных результатов.";
      graphStatus.dataset.state = "warning";
    } else {
      try {
        const saved = await persistUsernameGraph(username, rows);
        graphStatus.textContent = "Граф обновлён: добавлено " + saved.nodes + " сущностей и " + saved.edges + " связей в активное расследование.";
        graphStatus.dataset.state = "success";
      } catch (error) {
        graphStatus.textContent = "Поиск завершён, но граф не обновлён: " + (error.message || "ошибка сохранения");
        graphStatus.dataset.state = "error";
      }
    }
  }
}

let searchInProgress = false;

function wireSearch() {
  const btn = document.getElementById("searchBtn");
  const input = document.getElementById("searchInput");
  if (!btn || !input) return;

  async function go() {
    if (searchInProgress) return;
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

    searchInProgress = true;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    const graphStatus = document.getElementById("usernameGraphStatus");
    if (graphStatus) { graphStatus.textContent = "Ожидание результатов…"; graphStatus.dataset.state = "running"; }
    try {
      await runAll(q);
    } finally {
      searchInProgress = false;
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

