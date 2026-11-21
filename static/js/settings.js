/**
 * Вкладка «API ключи»: поля для ключей, сохранение в .env, кнопка «Помощь» у каждого поля.
 */
const API = "/api";

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function initPanel(container) {
  if (container.dataset.inited) return;
  container.dataset.inited = "1";
  container.innerHTML = `
    <h2>API ключи</h2>
    <p class="description">Ключи сохраняются в файл .env в корне проекта. Каждый ключ — отдельное поле.</p>
    <form id="form-settings-keys">
      <div id="settings-keys-list"></div>
      <button type="submit" class="btn btn-primary btn-save">Сохранить</button>
    </form>
    <div id="settings-message" class="settings-message" role="status"></div>
    <section class="settings-key-row" id="tool-dependencies-panel" style="margin-top:24px">
      <h3>Инструменты и зависимости</h3>
      <p class="description">Проверяет подключённые инструменты и устанавливает отсутствующие Python-зависимости в то же окружение, где запущена OSINT Panel.</p>
      <div class="key-input-wrap" style="gap:10px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" id="btn-check-tools">⌁ Проверить инструменты</button>
      </div>
      <div id="tool-dependencies-status" class="settings-message" role="status" aria-live="polite"></div>
      <div id="tool-dependencies-results" style="display:grid;gap:8px;margin-top:12px"></div>
      <p class="description" style="margin-top:10px">Для системных программ (например, whois, subfinder и dnsx) панель покажет отсутствие, но не будет запускать sudo или менять системные пакеты автоматически.</p>
    </section>
    <section class="settings-key-row" id="system-update-panel" style="margin-top:24px">
      <h3>Обновление системы</h3>
      <p class="description">Проверка обновлений из официальной ветки GitHub. Перед установкой создаётся локальная резервная ветка.</p>
      <div id="update-status" class="settings-message" role="status">Проверяем версию…</div>
      <div class="key-input-wrap" style="gap:10px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" id="btn-install-update">↻ Обновить</button>
      </div>
      <div id="update-progress" hidden aria-live="polite" style="margin-top:16px;padding:14px;border:1px solid var(--border,rgba(145,170,198,.18));border-radius:10px;background:rgba(8,18,30,.55)">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px">
          <strong id="update-progress-stage">Подготовка…</strong>
          <span id="update-progress-percent" style="font-variant-numeric:tabular-nums">0%</span>
        </div>
        <div id="update-progress-track" role="progressbar" aria-label="Ход обновления" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="height:8px;border-radius:99px;background:rgba(145,170,198,.16);overflow:hidden">
          <div id="update-progress-bar" style="height:100%;width:0%;border-radius:99px;background:var(--accent,#59b8f5);transition:width .35s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:9px;color:var(--text-muted,#91a2b6);font-size:12px;font-variant-numeric:tabular-nums">
          <span>Прошло: <strong id="update-elapsed">00:00</strong></span>
          <span>Осталось (оценка): <strong id="update-eta">рассчитывается</strong></span>
        </div>
      </div>
    </section>
  `;

  const listEl = container.querySelector("#settings-keys-list");
  const form = container.querySelector("#form-settings-keys");
  const messageEl = container.querySelector("#settings-message");
  const toolCheckBtn = container.querySelector("#btn-check-tools");
  const toolCheckStatus = container.querySelector("#tool-dependencies-status");
  const toolCheckResults = container.querySelector("#tool-dependencies-results");

  function renderToolChecks(rows) {
    toolCheckResults.innerHTML = rows.map((item) => {
      const ready = item.status === "ready";
      const state = ready ? "ГОТОВ" : "НУЖНО ВНИМАНИЕ";
      const details = item.message || (item.missing_packages?.length
        ? "Не установлено: " + item.missing_packages.join(", ")
        : item.missing_binaries?.length ? "Не найдены: " + item.missing_binaries.join(", ") : "");
      return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:11px 13px;border:1px solid var(--border,rgba(145,170,198,.18));border-radius:9px;background:rgba(8,18,30,.38)">
        <div style="min-width:0"><strong>${escapeHtml(item.name)}</strong>${details ? `<div style="margin-top:4px;color:var(--text-muted,#91a2b6);font-size:12px;overflow-wrap:anywhere">${escapeHtml(details)}</div>` : ""}</div>
        <span style="white-space:nowrap;font-size:11px;color:${ready ? "var(--accent,#59b8f5)" : "#e5ad62"}">${escapeHtml(state)}</span>
      </div>`;
    }).join("");
  }

  toolCheckBtn.addEventListener("click", async () => {
    toolCheckBtn.disabled = true;
    toolCheckBtn.textContent = "Проверяем и устанавливаем…";
    toolCheckStatus.style.display = "block";
    toolCheckStatus.textContent = "Проверяем наличие инструментов. Установка отсутствующих Python-пакетов может занять несколько минут.";
    toolCheckStatus.className = "settings-message";
    toolCheckResults.innerHTML = "";
    try {
      const response = await fetch(`${API}/tools/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "OSINT-Panel" },
        body: "{}",
        cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Не удалось проверить зависимости.");
      renderToolChecks(data.tools || []);
      const ready = (data.tools || []).filter(x => x.status === "ready").length;
      const total = (data.tools || []).length;
      const failed = (data.tools || []).filter(x => x.action === "failed").length;
      toolCheckStatus.textContent = `Проверка завершена: ${ready} из ${total} инструментов готовы.` + (failed ? ` Не удалось установить зависимости для ${failed} инструментов.` : "");
      toolCheckStatus.className = "settings-message " + (failed ? "error" : "success");
    } catch (err) {
      toolCheckStatus.textContent = "Ошибка проверки: " + err.message;
      toolCheckStatus.className = "settings-message error";
    } finally {
      toolCheckBtn.disabled = false;
      toolCheckBtn.textContent = "⌁ Проверить инструменты";
    }
  });

  const updateStatus = container.querySelector("#update-status");
  const installUpdateBtn = container.querySelector("#btn-install-update");
  const progressPanel = container.querySelector("#update-progress");
  const progressTrack = container.querySelector("#update-progress-track");
  const progressBar = container.querySelector("#update-progress-bar");
  const progressStage = container.querySelector("#update-progress-stage");
  const progressPercent = container.querySelector("#update-progress-percent");
  const elapsedLabel = container.querySelector("#update-elapsed");
  const etaLabel = container.querySelector("#update-eta");
  let updateAvailable = false;
  let updateStartedAt = 0;
  let lastProgress = 0;
  let pollFailures = 0;

  function updateMessage(text, isError = false) {
    updateStatus.textContent = text;
    updateStatus.className = "settings-message " + (isError ? "error" : "success");
    updateStatus.style.display = "block";
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return hours
      ? String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0")
      : String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
  }

  function renderUpdateProgress(data) {
    const percent = Math.max(0, Math.min(100, Number(data.progress) || 0));
    lastProgress = percent;
    progressPanel.hidden = false;
    progressStage.textContent = data.stage || "Выполняется обновление";
    progressPercent.textContent = Math.round(percent) + "%";
    progressBar.style.width = percent + "%";
    progressTrack.setAttribute("aria-valuenow", String(Math.round(percent)));

    const started = data.started_at ? Date.parse(data.started_at) : updateStartedAt;
    if (Number.isFinite(started) && started > 0) updateStartedAt = started;
    const elapsed = updateStartedAt ? (Date.now() - updateStartedAt) / 1000 : 0;
    elapsedLabel.textContent = formatDuration(elapsed);

    if (percent >= 100) {
      etaLabel.textContent = "завершено";
    } else if (percent >= 3 && elapsed > 2) {
      const remaining = elapsed * (100 - percent) / percent;
      etaLabel.textContent = "~" + formatDuration(remaining);
    } else {
      etaLabel.textContent = "рассчитывается";
    }
  }

  async function checkForUpdates() {
    installUpdateBtn.disabled = true;
    installUpdateBtn.textContent = "Проверяем…";
    updateMessage("Проверяем GitHub…");
    try {
      const res = await fetch(`${API}/system/update`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось проверить обновления");
      updateAvailable = Boolean(data.available);
      updateMessage(updateAvailable
        ? `Доступно обновление: ${data.commits_behind} новых коммит(ов). Текущая версия: ${data.current}.`
        : `Установлена последняя версия (${data.current}).`);
      installUpdateBtn.disabled = false;
      installUpdateBtn.textContent = "↻ Обновить";
    } catch (err) {
      updateAvailable = false;
      updateMessage("Проверка не выполнена: " + err.message, true);
    } finally {
      installUpdateBtn.disabled = false;
      installUpdateBtn.textContent = "↻ Обновить";
    }
  }

  async function pollUpdateJob(jobId) {
    try {
      const res = await fetch(`${API}/system/update/status?job_id=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось получить состояние обновления");
      pollFailures = 0;
      renderUpdateProgress(data);

      if (data.state === "completed") {
        const result = data.result || {};
        progressBar.style.width = "100%";
        progressPercent.textContent = "100%";
        progressTrack.setAttribute("aria-valuenow", "100");
        etaLabel.textContent = "завершено";
        if (result.updated) {
          updateMessage("Обновление установлено. Резервная ветка: " + (result.backup_branch || "создана") + ". Панель перезапускается автоматически; дождитесь её повторного открытия.");
        } else {
          updateMessage(result.message || "Обновление завершено.");
          installUpdateBtn.disabled = false;
          installUpdateBtn.textContent = "↻ Обновить";
        }
        return;
      }

      if (data.state === "error") {
        updateMessage("Обновление не завершено: " + (data.error || "неизвестная ошибка"), true);
        installUpdateBtn.disabled = false;
        installUpdateBtn.textContent = "↻ Обновить";
        return;
      }

      window.setTimeout(() => pollUpdateJob(jobId), 900);
    } catch (err) {
      pollFailures += 1;
      if (pollFailures <= 12) {
        updateMessage("Связь с сервером временно потеряна. Повторная проверка состояния…");
        window.setTimeout(() => pollUpdateJob(jobId), 1200);
        return;
      }
      if (lastProgress >= 90) {
        updateMessage("Сервер завершает обновление и перезапускается. Подождите несколько секунд, затем обновите страницу.");
      } else {
        updateMessage("Не удалось получить состояние обновления: " + err.message, true);
        installUpdateBtn.disabled = false;
      }
    }
  }

  installUpdateBtn.addEventListener("click", async () => {
    installUpdateBtn.disabled = true;
    installUpdateBtn.textContent = "Проверяем…";
    try {
      const checkRes = await fetch(`${API}/system/update`, { cache: "no-store" });
      const checkData = await checkRes.json();
      if (!checkRes.ok) throw new Error(checkData.error || "Не удалось проверить обновления");
      updateAvailable = Boolean(checkData.available);
      if (!updateAvailable) {
        updateMessage(`Установлена последняя версия (${checkData.current}).`);
        installUpdateBtn.textContent = "↻ Обновить";
        installUpdateBtn.disabled = false;
        return;
      }
      if (!confirm("Найдены обновления (" + checkData.commits_behind + " коммитов). Установить их сейчас? Перед обновлением будет создана резервная ветка.")) {
        installUpdateBtn.textContent = "↻ Обновить";
        installUpdateBtn.disabled = false;
        return;
      }
    } catch (err) {
      updateMessage("Проверка не выполнена: " + err.message, true);
      installUpdateBtn.textContent = "↻ Обновить";
      installUpdateBtn.disabled = false;
      return;
    }
    progressPanel.hidden = false;
    updateStartedAt = Date.now();
    lastProgress = 0;
    pollFailures = 0;
    renderUpdateProgress({ progress: 0, stage: "Запуск обновления" });
    updateMessage("Запускаем обновление. Не закрывайте панель…");
    try {
      const res = await fetch(`${API}/system/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "OSINT-Panel" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok && !(res.status === 409 && data.job_id)) {
        throw new Error(data.error || "Ошибка запуска обновления");
      }
      if (!data.job_id) throw new Error("Сервер не вернул идентификатор задачи обновления.");
      pollUpdateJob(data.job_id);
    } catch (err) {
      updateMessage("Обновление не запущено: " + err.message, true);
      installUpdateBtn.disabled = false;
      installUpdateBtn.textContent = "↻ Обновить";
      installUpdateBtn.disabled = false;
    }
  });

  function showMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.className = "settings-message " + (isError ? "error" : "success");
    messageEl.style.display = text ? "block" : "none";
  }

  async function loadKeys() {
    const res = await fetch(`${API}/settings/keys`);
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.keys)) throw new Error(data.error || "Не удалось загрузить настройки");
    listEl.innerHTML = data.keys
      .map(
        (k) => `
      <div class="settings-key-row" data-key-id="${escapeHtml(k.id)}">
        <label>${escapeHtml(k.label)}</label>
        <div class="key-input-wrap">
          <input type="password" name="${escapeHtml(k.id)}" placeholder="${k.isSet ? "Ключ сохранён · пустое поле оставит его без изменений" : "Введите ключ"}" autocomplete="new-password" spellcheck="false">
          <button type="button" class="btn-help" aria-expanded="false" data-key-id="${escapeHtml(k.id)}">Помощь</button>
        </div>
        <div class="help-block" id="help-${escapeHtml(k.id)}" role="region">
          ${escapeHtml(k.helpText)}<br>
          <a href="${escapeHtml(k.helpUrl)}" target="_blank" rel="noopener">Инструкция и получение ключа →</a>
        </div>
      </div>
    `
      )
      .join("");

    listEl.querySelectorAll(".btn-help").forEach((btn) => {
      btn.addEventListener("click", () => {
        const keyId = btn.dataset.keyId;
        const block = document.getElementById(`help-${keyId}`);
        const open = block.classList.toggle("visible");
        btn.setAttribute("aria-expanded", open);
      });
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {};
    listEl.querySelectorAll('input[name]').forEach((input) => {
      const v = (fd.get(input.name) || "").trim();
      // Пустое поле не должно стирать ранее сохранённый ключ.
      if (v) payload[input.name] = v;
    });
    showMessage("");
    try {
      const res = await fetch(`${API}/settings/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || res.statusText || "Не удалось сохранить ключи");
      showMessage(Object.keys(payload).length ? "Изменения сохранены в .env. Пустые поля оставлены без изменений." : "Изменений нет: сохранённые ключи не затронуты.");
      await loadKeys();
    } catch (err) {
      showMessage("Ошибка: " + err.message, true);
    }
  });

  loadKeys().catch((err) => showMessage("Ошибка загрузки: " + err.message, true));
  checkForUpdates();
}
