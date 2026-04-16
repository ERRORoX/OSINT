/**
 * История запусков (как в @проба): список, удаление, очистка.
 * Использует backend: GET /api/history, DELETE /api/history/<id>, POST /api/history/clear
 */
const API = "/api";
const DOMAIN_TOOLS_IDS = ["theharvester", "domain-search", "shodan", "subfinder", "dnsx"];
const USERNAME_TOOLS_IDS = ["sherlock", "maigret", "social-analyzer", "blackbird"];

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

export function initPanel(container) {
  if (container.dataset.inited) return;
  container.dataset.inited = "1";
  container.innerHTML = `
    <div class="tool-view tool-google-osint-page">
      <section class="tool-view-section glass-card">
        <div class="card-header"><span>История</span></div>
        <div class="glass-card-content">
          <div class="tool-form-actions" style="margin-top:0">
            <button type="button" class="btn btn-secondary" id="hist-refresh">Обновить</button>
            <button type="button" class="btn btn-danger" id="hist-clear">Очистить</button>
          </div>
          <div id="hist-status" class="tool-cli-status" role="status"></div>
        </div>
      </section>

      <section class="tool-view-section glass-card">
        <div class="card-header"><span>Запуски</span></div>
        <div class="glass-card-content">
          <div id="hist-list"></div>
        </div>
      </section>
    </div>
  `;

  const listEl = container.querySelector("#hist-list");
  const statusEl = container.querySelector("#hist-status");
  const btnRefresh = container.querySelector("#hist-refresh");
  const btnClear = container.querySelector("#hist-clear");

  function setStatus(text, loading = false) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-loading", !!loading);
  }

  function renderItem(item) {
    const id = item.id;
    const tool = escapeHtml(item.tool_id || "");
    const created = escapeHtml(item.created_at || "");
    const err = item.error ? `<div style="margin-top:6px;color:var(--error)">${escapeHtml(item.error)}</div>` : "";
    const params = item.params ? escapeHtml(JSON.stringify(item.params)) : "";
    const result = item.result ? escapeHtml(JSON.stringify(item.result, null, 2)) : "";
    return `
      <div class="glass-card" style="margin-bottom:12px">
        <div class="card-header">
          <span>${tool || "run"}</span>
          <span style="margin-left:auto;color:var(--text-muted);font-size:11px">${created}</span>
        </div>
        <div class="glass-card-content">
          <div style="font-size:12px;color:var(--text-muted)">params: <code>${params}</code></div>
          ${err}
          ${result ? `<details style="margin-top:10px">
            <summary style="cursor:pointer;color:var(--text-muted);font-size:12px">Результат</summary>
            <pre class="tool-results-card__pre" style="margin-top:10px">${result}</pre>
          </details>` : ""}
          <div class="tool-form-actions" style="margin-top:10px">
            <button type="button" class="btn btn-primary" data-action="open" data-tool="${escapeHtml(item.tool_id || "")}">Открыть</button>
            <button type="button" class="btn btn-secondary" data-action="rerun" data-tool="${escapeHtml(item.tool_id || "")}">Повторить</button>
            <button type="button" class="btn btn-secondary" data-action="delete" data-id="${id}">Удалить</button>
          </div>
        </div>
      </div>
    `;
  }

  async function load() {
    setStatus("Загрузка…", true);
    listEl.innerHTML = "";
    try {
      const res = await fetch(`${API}/history?limit=50`);
      const data = await res.json().catch(() => []);
      const items = Array.isArray(data) ? data : [];
      if (!items.length) {
        listEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">История пуста</div>`;
      } else {
        listEl.innerHTML = items.map(renderItem).join("");
      }
      setStatus(`Готово. Записей: ${items.length}`, false);
    } catch (e) {
      listEl.innerHTML = `<div class="tool-results-card tool-google-osint-block error"><div class="tool-results-card__content">${escapeHtml(e.message || "Ошибка")}</div></div>`;
      setStatus("Ошибка загрузки.", false);
    } finally {
      statusEl.classList.remove("is-loading");
    }
  }

  btnRefresh.addEventListener("click", load);

  btnClear.addEventListener("click", async () => {
    if (!confirm("Очистить историю?")) return;
    btnClear.disabled = true;
    setStatus("Очищаю…", true);
    try {
      const res = await fetch(`${API}/history/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Не удалось очистить");
      await load();
    } catch (e) {
      setStatus(e.message || "Ошибка", false);
    } finally {
      btnClear.disabled = false;
      statusEl.classList.remove("is-loading");
    }
  });

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const toolId = (btn.dataset.tool || "").trim();
    const rootToolId = DOMAIN_TOOLS_IDS.includes(toolId)
      ? "domain-tools"
      : USERNAME_TOOLS_IDS.includes(toolId)
        ? "username-tools"
        : toolId;
    if (action === "delete") {
      btn.disabled = true;
      try {
        await fetch(`${API}/history/${id}`, { method: "DELETE" });
      } catch (_) {}
      await load();
      btn.disabled = false;
      return;
    }

    if (action === "open") {
      if (rootToolId) window.location.hash = rootToolId;
      return;
    }

    if (action === "rerun") {
      btn.disabled = true;
      setStatus("Запускаю…", true);
      try {
        // Находим params текущей карточки через соседние данные в DOM нельзя надёжно,
        // поэтому перезагружаем историю и берём item по id.
        const res = await fetch(`${API}/history?limit=50`);
        const data = await res.json().catch(() => []);
        const items = Array.isArray(data) ? data : [];
        const it = items.find((x) => String(x.id) === String(id));
        const params = (it && it.params) ? it.params : {};
        const r = await fetch(`${API}/tools/${encodeURIComponent(toolId)}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok || out.success === false) throw new Error(out.error || "Ошибка запуска");
        setStatus("Готово. Обновляю историю…", false);
        await load();
      } catch (err2) {
        setStatus(err2.message || "Ошибка", false);
      } finally {
        btn.disabled = false;
        statusEl.classList.remove("is-loading");
      }
    }
  });

  load();
}

