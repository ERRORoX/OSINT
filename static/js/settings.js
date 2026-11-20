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
    <section class="settings-key-row" id="system-update-panel" style="margin-top:24px">
      <h3>Обновление системы</h3>
      <p class="description">Проверка обновлений из официальной ветки GitHub. Перед установкой создаётся локальная резервная ветка.</p>
      <div id="update-status" class="settings-message" role="status">Проверяем версию…</div>
      <div class="key-input-wrap" style="gap:10px;flex-wrap:wrap">
        <button type="button" class="btn btn-help" id="btn-check-update">Проверить обновления</button>
        <button type="button" class="btn btn-primary" id="btn-install-update" disabled>Установить обновление</button>
      </div>
    </section>
  `;

  const listEl = container.querySelector("#settings-keys-list");
  const form = container.querySelector("#form-settings-keys");
  const messageEl = container.querySelector("#settings-message");
  const updateStatus = container.querySelector("#update-status");
  const checkUpdateBtn = container.querySelector("#btn-check-update");
  const installUpdateBtn = container.querySelector("#btn-install-update");
  let updateAvailable = false;

  function updateMessage(text, isError = false) {
    updateStatus.textContent = text;
    updateStatus.className = "settings-message " + (isError ? "error" : "success");
    updateStatus.style.display = "block";
  }

  async function checkForUpdates() {
    checkUpdateBtn.disabled = true;
    installUpdateBtn.disabled = true;
    updateMessage("Проверяем GitHub…");
    try {
      const res = await fetch(`${API}/system/update`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось проверить обновления");
      updateAvailable = Boolean(data.available);
      updateMessage(updateAvailable
        ? `Доступно обновление: ${data.commits_behind} новых коммит(ов). Текущая версия: ${data.current}.`
        : `Установлена последняя версия (${data.current}).`);
      installUpdateBtn.disabled = !updateAvailable;
    } catch (err) {
      updateAvailable = false;
      updateMessage("Проверка не выполнена: " + err.message, true);
    } finally {
      checkUpdateBtn.disabled = false;
    }
  }

  checkUpdateBtn.addEventListener("click", checkForUpdates);
  installUpdateBtn.addEventListener("click", async () => {
    if (!updateAvailable || !confirm("Установить обновление из GitHub? Перед обновлением будет создана резервная ветка.")) return;
    installUpdateBtn.disabled = true;
    checkUpdateBtn.disabled = true;
    updateMessage("Устанавливаем обновление. Не закрывайте панель…");
    try {
      const res = await fetch(`${API}/system/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "OSINT-Panel" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка установки");
      updateAvailable = false;
      updateMessage(data.updated
        ? `${data.message} Резервная ветка: ${data.backup_branch}. Остановите сервер (Ctrl+C) и запустите снова: python3 run.py.`
        : data.message);
    } catch (err) {
      updateMessage("Обновление не установлено: " + err.message, true);
      installUpdateBtn.disabled = false;
    } finally {
      checkUpdateBtn.disabled = false;
    }
  });

  function showMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.className = "settings-message " + (isError ? "error" : "success");
    messageEl.style.display = text ? "block" : "none";
  }

  async function loadKeys() {
    const res = await fetch(`${API}/settings/keys`);
    if (!res.ok) throw new Error("Не удалось загрузить настройки");
    const data = await res.json();
    listEl.innerHTML = data.keys
      .map(
        (k) => `
      <div class="settings-key-row" data-key-id="${escapeHtml(k.id)}">
        <label>${escapeHtml(k.label)}</label>
        <div class="key-input-wrap">
          <input type="password" name="${escapeHtml(k.id)}" placeholder="${k.isSet ? "Ключ сохранён (введите новый, чтобы заменить)" : "Введите ключ"}" autocomplete="off">
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
      payload[input.name] = v;
    });
    showMessage("");
    try {
      const res = await fetch(`${API}/settings/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(res.statusText);
      showMessage("Ключи сохранены в .env");
    } catch (err) {
      showMessage("Ошибка: " + err.message, true);
    }
  });

  loadKeys().catch((err) => showMessage("Ошибка загрузки: " + err.message, true));
  checkForUpdates();
}
