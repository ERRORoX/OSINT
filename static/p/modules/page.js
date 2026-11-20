(() => {
  const $ = (id) => document.getElementById(id);
  const list = $("mm-list");
  const refresh = $("mm-refresh");
  const search = $("mm-search");
  const error = $("mm-error");
  let modules = [];

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);

  const statusLabel = (status) => ({
    integrated: "Интегрирован",
    legacy: "Старый формат",
    migrating: "Переносится",
    planned: "Запланирован",
    disabled: "Отключён"
  }[status] || "Неизвестно");

  function render() {
    const query = (search.value || "").trim().toLowerCase();
    const filtered = modules.filter((m) => [
      m.id, m.name, m.category, m.status, m.description
    ].join(" ").toLowerCase().includes(query));

    if (!filtered.length) {
      list.innerHTML = '<div class="mm-empty">Модули не найдены.</div>';
      return;
    }

    list.innerHTML = filtered.map((m) => {
      const issues = Array.isArray(m.issues) ? m.issues : [];
      const hasError = issues.some((item) => item.severity === "error");
      const entrypoints = Object.entries(m.entrypoints || {});
      const meta = [
        ["Версия", m.version || "—"],
        ["Категория", m.category || "—"],
        ["Manifest", m.manifest || "—"],
        ["Состояние", m.enabled ? "enabled" : "disabled"]
      ];
      const entryHtml = entrypoints.map(([key, value]) =>
        '<dt>' + esc(key) + '</dt><dd>' + esc(value) + '</dd>'
      ).join("");
      const metaHtml = meta.map(([key, value]) =>
        '<dt>' + esc(key) + '</dt><dd>' + esc(value) + '</dd>'
      ).join("");
      const issuesHtml = issues.length
        ? '<div class="mm-issues ' + (hasError ? "error" : "") + '">' +
          '<strong>Диагностика: ' + issues.length + '</strong><ul>' +
          issues.map((item) => '<li>' + esc(item.message) + '</li>').join("") +
          '</ul></div>'
        : "";
      return '<article class="mm-card">' +
        '<div class="mm-card-head"><div class="mm-card-title"><h2>' + esc(m.name) +
        '</h2><div class="mm-card-id">' + esc(m.id) + '</div></div>' +
        '<span class="mm-status ' + esc(m.status) + '">' + esc(statusLabel(m.status)) + '</span></div>' +
        '<p class="mm-description">' + esc(m.description || "Описание не добавлено.") + '</p>' +
        '<dl class="mm-meta">' + metaHtml + entryHtml + '</dl>' + issuesHtml +
        '</article>';
    }).join("");
  }

  async function load() {
    refresh.disabled = true;
    refresh.textContent = "Загрузка…";
    error.hidden = true;
    try {
      const response = await fetch("/api/modules", {
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить Module Registry.");
      modules = Array.isArray(data.modules) ? data.modules : [];
      const summary = data.summary || {};
      $("mm-total").textContent = summary.discovered ?? modules.length;
      $("mm-valid").textContent = summary.valid ?? "—";
      $("mm-invalid").textContent = summary.invalid ?? "—";
      $("mm-enabled").textContent = summary.enabled ?? "—";
      $("mm-runtime-errors").textContent = summary.runtime_errors ?? 0;
      $("mm-updated").textContent = "Обновлено: " + new Date().toLocaleTimeString();
      render();
    } catch (err) {
      error.textContent = err.message || "Ошибка загрузки реестра.";
      error.hidden = false;
      list.innerHTML = '<div class="mm-empty">Не удалось получить список модулей.</div>';
    } finally {
      refresh.disabled = false;
      refresh.textContent = "↻ Обновить список";
    }
  }

  refresh.addEventListener("click", load);
  search.addEventListener("input", render);
  load();
})();
