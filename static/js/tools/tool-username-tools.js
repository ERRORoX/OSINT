/**
 * Раздел «Поиск по имени пользователя» в стиле Google OSINT: одно поле, чекбоксы инструментов, одна кнопка, терминал + результаты.
 */
import { apiRun } from "../app.js";
import { renderResultsCards } from "./results-cards.js";

const USERNAME_TOOLS = [
  { id: "sherlock", name: "Sherlock", desc: "Сотни соцсетей" },
  { id: "maigret", name: "Maigret", desc: "Тысячи сайтов" },
  { id: "social-analyzer", name: "Social Analyzer", desc: "900+ сайтов" },
  { id: "blackbird", name: "Blackbird", desc: "600+ платформ WhatsMyName" },
];

export function initPanel(container) {
  if (container.dataset.inited) return;
  container.dataset.inited = "1";
  container.innerHTML = `
    <div class="tool-view username-tools-page tool-google-osint-page">
      <section class="tool-view-section tool-view-section--search">
        <h2 class="tool-view-section__title">ПОИСК ПО ИМЕНИ ПОЛЬЗОВАТЕЛЯ</h2>
        <p class="tool-cli-desc">Введите имя пользователя (без пробелов). Отметьте галочками инструменты для запуска, затем нажмите ПОИСК. Результаты появятся в терминале и в блоках ниже.</p>
        <form id="form-username-tools" class="tool-google-osint-form">
          <div class="form-group">
            <label for="ut-username">Имя пользователя</label>
            <input type="text" id="ut-username" name="username" placeholder="username" autocomplete="off">
          </div>
          <div class="tool-google-osint-checkboxes" id="ut-tools-checkboxes">
            ${USERNAME_TOOLS.map((t) => `<label class="grabcam-feature-check"><input type="checkbox" name="tool" value="${t.id}" checked> ${t.name}</label>`).join("")}
          </div>
          <div class="tool-form-actions">
            <button type="submit" class="btn btn-primary" id="btn-ut-run">ПОИСК</button>
            <button type="button" class="btn btn-secondary" id="btn-ut-clear">ОЧИСТИТЬ</button>
          </div>
        </form>
      </section>
      <section class="tool-view-section tool-view-section--terminal">
        <h2 class="tool-view-section__title">ТЕРМИНАЛ</h2>
        <div id="ut-terminal" class="tool-terminal" role="log"></div>
        <div id="ut-status" class="tool-cli-status" role="status"></div>
      </section>
      <section class="tool-view-section tool-view-section--results">
        <h2 class="tool-view-section__title">РЕЗУЛЬТАТЫ</h2>
        <div id="ut-results" class="tool-google-osint-results tool-results-overview"></div>
      </section>
    </div>
  `;

  const form = container.querySelector("#form-username-tools");
  const usernameInput = container.querySelector("#ut-username");
  const terminalEl = container.querySelector("#ut-terminal");
  const statusEl = container.querySelector("#ut-status");
  const resultsEl = container.querySelector("#ut-results");
  const btnRun = container.querySelector("#btn-ut-run");
  const btnClear = container.querySelector("#btn-ut-clear");

  btnClear.addEventListener("click", () => {
    usernameInput.value = "";
    terminalEl.textContent = "";
    statusEl.textContent = "";
    statusEl.className = "tool-cli-status";
    resultsEl.innerHTML = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = (usernameInput.value || "").trim();
    const selectedTools = Array.from(container.querySelectorAll('input[name="tool"]:checked')).map((c) => c.value);

    if (!username) {
      statusEl.textContent = "Введите имя пользователя.";
      statusEl.className = "tool-cli-status error";
      return;
    }
    if (username.includes(" ")) {
      statusEl.textContent = "Введите одно имя без пробелов.";
      statusEl.className = "tool-cli-status error";
      return;
    }
    if (!selectedTools.length) {
      statusEl.textContent = "Отметьте хотя бы один инструмент.";
      statusEl.className = "tool-cli-status error";
      return;
    }

    statusEl.className = "tool-cli-status";
    statusEl.textContent = "";
    const btnText = btnRun.textContent;
    btnRun.textContent = "Подождите…";
    btnRun.disabled = true;
    btnRun.classList.add("is-loading");
    terminalEl.textContent = "[+] Имя: " + username + "\n[+] Запуск: " + selectedTools.join(", ") + "\n";
    resultsEl.innerHTML = "";

    const sections = [];
    const logParts = [];

    for (const toolId of selectedTools) {
      const toolName = USERNAME_TOOLS.find((t) => t.id === toolId)?.name || toolId;
      terminalEl.textContent += "\n[+] " + toolName + "...\n";
      statusEl.textContent = "Запуск: " + toolName + "...";

      try {
        const data = await apiRun(toolId, { username });
        const out = (data.output || data.error || "").trim();
        sections.push({ id: toolId, title: toolName, output: out || "(нет вывода)", success: data.success });
        logParts.push("========== " + toolName + " ==========\n" + (out || "(нет вывода)"));
        terminalEl.textContent += (out ? out + "\n" : "") + "----------\n";
      } catch (err) {
        const msg = err.message || "Ошибка запроса";
        sections.push({ id: toolId, title: toolName, output: msg, success: false });
        logParts.push("========== " + toolName + " ==========\n[!] " + msg);
        terminalEl.textContent += "[!] " + msg + "\n----------\n";
      }
    }

    statusEl.textContent = "Готово.";
    const fullLog = "[+] Имя: " + username + "\n[+] Инструменты: " + selectedTools.join(", ") + "\n\n" + logParts.join("\n\n");
    terminalEl.textContent = fullLog;

    renderResultsCards(resultsEl, sections);

    btnRun.textContent = btnText;
    btnRun.disabled = false;
    btnRun.classList.remove("is-loading");
  });
}
