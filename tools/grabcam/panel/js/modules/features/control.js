/**
 * Управление безопасной учебной страницей: запуск, остановка и статус сервера.
 */
import { state } from "../state.js";
import { apiRun } from "/js/app-core.js";
import { escapeHtml } from "../utils.js";
import { TOOL_ID, API, METHOD_HINTS, POLL_IDS, POLL_INTERVALS } from "../config.js";

export function initControl(container) {
  const form = container.querySelector("#gc-form");
  const resultEl = container.querySelector("#gc-result");
  const statusEl = container.querySelector("#gc-status");
  const copyBtn = container.querySelector("#gc-copy-btn");
  const submitBtn = container.querySelector("#gc-btn-start");
  const stopBtn = container.querySelector("#gc-btn-stop");
  const methodSelect = container.querySelector("#gc-method");
  const methodHint = container.querySelector("#gc-method-hint");
  const statusCheckbox = container.querySelector("#gc-feat-status");

  function showCopyFeedback(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function showLink(link, localUrl) {
    const url = link || localUrl || "";
    if (!resultEl) return;
    if (url === state.lastLinkUrl) return;
    state.lastLinkUrl = url;
    resultEl.classList.remove("gc-link-placeholder");
    if (url) {
      resultEl.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="gc-link-url">${escapeHtml(url)}</a>`;
      if (copyBtn) {
        copyBtn.setAttribute("data-copy", url);
        copyBtn.style.display = "inline-flex";
      }
    } else {
      resultEl.textContent = "(ссылка пока не получена)";
      resultEl.classList.add("gc-link-placeholder");
      if (copyBtn) copyBtn.style.display = "none";
    }
  }

  async function pollStatus() {
    try {
      const response = await fetch(API.runStatus, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const status = await response.json();
      if (statusCheckbox) statusCheckbox.checked = !!status.running;
      if (status.link || status.local_url) {
        showLink(status.link || null, status.local_url || null);
        if (resultEl) resultEl.className = "gc-link-box gc-link-success";
      }
      if (statusEl) {
        statusEl.textContent = status.error || (status.running
          ? (status.link ? "Публичный туннель активен." : status.local_url ? "Локальный сервер активен." : "Подключение к туннелю…")
          : "Сервер остановлен.");
      }
      if (!status.running) {
        if (POLL_IDS.status) clearInterval(POLL_IDS.status);
        POLL_IDS.status = null;
        if (submitBtn) { submitBtn.style.display = ""; submitBtn.disabled = false; }
        if (stopBtn) stopBtn.style.display = "none";
      } else if (status.started_at && !state.sessionStartTime) {
        state.sessionStartTime = status.started_at * 1000;
      }
      return !!status.running;
    } catch (error) {
      if (statusEl) statusEl.textContent = "Не удалось получить статус: " + error.message;
      return true;
    }
  }

  function updateMethodHint() {
    if (methodHint && methodSelect) methodHint.textContent = METHOD_HINTS[methodSelect.value] || METHOD_HINTS.php_only;
  }
  methodSelect?.addEventListener("change", updateMethodHint);
  updateMethodHint();

  stopBtn?.addEventListener("click", async () => {
    stopBtn.disabled = true;
    try {
      const response = await fetch(API.stop, { method: "POST" });
      const data = await response.json();
      if (statusEl) statusEl.textContent = data.message || "Остановка…";
      await pollStatus();
    } catch (error) {
      if (statusEl) statusEl.textContent = "Ошибка остановки: " + error.message;
    } finally {
      stopBtn.disabled = false;
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const params = { method: (new FormData(form).get("method") || "php_only").toString() };
    if (resultEl) {
      resultEl.textContent = "";
      resultEl.className = "gc-link-box";
      resultEl.classList.remove("gc-link-placeholder");
    }
    if (statusEl) statusEl.textContent = "Запуск учебного сервера…";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.display = "none"; }
    if (stopBtn) stopBtn.style.display = "inline-block";
    try {
      const data = await apiRun(TOOL_ID, params);
      if (!data.success || !data.started) throw new Error(data.error || "Сервер не запустился.");
      state.sessionStartTime = Date.now();
      if (data.local_url) showLink(null, data.local_url);
      if (statusEl) statusEl.textContent = data.message || "Сервер запускается…";
      if (POLL_IDS.status) clearInterval(POLL_IDS.status);
      POLL_IDS.status = setInterval(pollStatus, POLL_INTERVALS.status);
      await pollStatus();
    } catch (error) {
      if (statusEl) statusEl.textContent = error.message || "Ошибка запуска";
      if (submitBtn) { submitBtn.style.display = ""; submitBtn.disabled = false; }
      if (stopBtn) stopBtn.style.display = "none";
      if (resultEl) {
        resultEl.className = "gc-link-box gc-link-error";
        resultEl.textContent = error.message || "Ошибка запуска";
      }
    }
  });

  return { showLink, pollStatus, showCopyFeedback };
}
