/**
 * Раздел «Поиск по домену» в стиле Google OSINT: одно поле, чекбоксы инструментов, одна кнопка, терминал + результаты.
 */
import { apiRun } from "../app.js";
import { escapeHtml, renderResultsCards } from "./results-cards.js";

function normalizeDomain(s) {
  if (!s || typeof s !== "string") return "";
  let t = s.trim().toLowerCase();
  if (t.startsWith("https://")) t = t.slice(8);
  else if (t.startsWith("http://")) t = t.slice(7);
  const slash = t.indexOf("/");
  if (slash !== -1) t = t.slice(0, slash);
  if (t.startsWith("www.")) t = t.slice(4);
  return t;
}

const DOMAIN_TOOLS = [
  { id: "domain-search", name: "Информация о домене", desc: "WHOIS, DNS, SSL, crt.sh" },
  { id: "theharvester", name: "theHarvester", desc: "Email, поддомены, хосты" },
  { id: "shodan", name: "Shodan", desc: "Поиск хостов по домену (API)" },
  { id: "subfinder", name: "Subfinder", desc: "Пассивный поиск поддоменов" },
  { id: "dnsx", name: "dnsx", desc: "DNS A/AAAA/CNAME" },
];

const SOURCE_OPTIONS = [
  { id: "duckduckgo", label: "DuckDuckGo" },
  { id: "brave", label: "Brave Search" },
  { id: "crtsh", label: "Crt.sh" },
  { id: "rapiddns", label: "RapidDNS" },
  { id: "hackertarget", label: "HackerTarget" },
  { id: "threatcrowd", label: "ThreatCrowd" },
  { id: "virustotal", label: "VirusTotal (API)" },
  { id: "shodan", label: "Shodan (API)" },
  { id: "hunter", label: "Hunter (API)" },
  { id: "google", label: "Google" },
  { id: "bing", label: "Bing" },
];

export function initPanel(container) {
  if (container.dataset.inited) return;
  container.dataset.inited = "1";
  container.innerHTML = `
    <div class="tool-view domain-tools-page tool-google-osint-page">
      <section class="tool-view-section tool-view-section--search">
        <h2 class="tool-view-section__title">ПОИСК ПО ДОМЕНУ</h2>
        <p class="tool-cli-desc">Введите домен. Отметьте галочками инструменты для запуска, затем нажмите ПОИСК. Результаты появятся в терминале и в блоках ниже.</p>
        <form id="form-domain-tools" class="tool-google-osint-form">
          <div class="form-group">
            <label for="dt-domain">Домен</label>
            <input type="text" id="dt-domain" name="domain" placeholder="example.com" autocomplete="off">
          </div>
          <div class="tool-google-osint-checkboxes" id="dt-tools-checkboxes">
            ${DOMAIN_TOOLS.map((t) => `<label class="grabcam-feature-check"><input type="checkbox" name="tool" value="${t.id}" checked> ${t.name}</label>`).join("")}
          </div>
          <div class="tool-domain-extra" id="dt-extra-theharvester">
            <span class="tool-domain-extra-label">theHarvester — источники:</span>
            <div class="th-sources-inline" id="dt-sources"></div>
            <label class="tool-domain-limit">Лимит <input type="number" id="dt-limit" value="100" min="10" max="500"></label>
          </div>
          <div class="tool-form-actions">
            <button type="submit" class="btn btn-primary" id="btn-dt-run">ПОИСК</button>
            <button type="button" class="btn btn-secondary" id="btn-dt-clear">ОЧИСТИТЬ</button>
          </div>
        </form>
      </section>
      <section class="tool-view-section tool-view-section--terminal">
        <h2 class="tool-view-section__title">ТЕРМИНАЛ</h2>
        <div id="dt-terminal" class="tool-terminal" role="log"></div>
        <div id="dt-status" class="tool-cli-status" role="status"></div>
      </section>
      <section class="tool-view-section tool-view-section--results">
        <h2 class="tool-view-section__title">РЕЗУЛЬТАТЫ</h2>
        <div id="dt-results" class="tool-google-osint-results tool-results-overview"></div>
      </section>
    </div>
  `;

  const form = container.querySelector("#form-domain-tools");
  const domainInput = container.querySelector("#dt-domain");
  const terminalEl = container.querySelector("#dt-terminal");
  const statusEl = container.querySelector("#dt-status");
  const resultsEl = container.querySelector("#dt-results");
  const btnRun = container.querySelector("#btn-dt-run");
  const btnClear = container.querySelector("#btn-dt-clear");
  const sourcesContainer = container.querySelector("#dt-sources");
  const extraTheharvester = container.querySelector("#dt-extra-theharvester");

  SOURCE_OPTIONS.forEach(({ id, label }) => {
    const labelEl = document.createElement("label");
    labelEl.className = "th-source-check";
    labelEl.innerHTML = `<input type="checkbox" name="source" value="${id}"> ${label}`;
    sourcesContainer.appendChild(labelEl);
  });
  container.querySelector('#dt-sources input[value="duckduckgo"]').checked = true;

  const theharvesterCheck = container.querySelector('input[name="tool"][value="theharvester"]');
  function toggleTheharvesterExtra() {
    extraTheharvester.style.display = theharvesterCheck.checked ? "flex" : "none";
  }
  toggleTheharvesterExtra();
  theharvesterCheck.addEventListener("change", toggleTheharvesterExtra);

  btnClear.addEventListener("click", () => {
    domainInput.value = "";
    terminalEl.textContent = "";
    statusEl.textContent = "";
    statusEl.className = "tool-cli-status";
    resultsEl.innerHTML = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const domain = normalizeDomain(domainInput.value);
    const selectedTools = Array.from(container.querySelectorAll('input[name="tool"]:checked')).map((c) => c.value);

    if (!domain) {
      statusEl.textContent = "Введите домен.";
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
    terminalEl.textContent = "[+] Домен: " + domain + "\n[+] Запуск: " + selectedTools.join(", ") + "\n";
    resultsEl.innerHTML = "";

    const sections = [];
    const logParts = [];

    for (const toolId of selectedTools) {
      const toolName = DOMAIN_TOOLS.find((t) => t.id === toolId)?.name || toolId;
      terminalEl.textContent += "\n[+] " + toolName + "...\n";
      statusEl.textContent = "Запуск: " + toolName + "...";

      try {
        let data;
        if (toolId === "domain-search") {
          data = await apiRun("domain-search", { domain });
        } else if (toolId === "shodan") {
          data = await apiRun("shodan", { domain });
        } else if (toolId === "subfinder") {
          data = await apiRun("subfinder", { domain });
        } else if (toolId === "dnsx") {
          data = await apiRun("dnsx", { domain });
        } else {
          const sources = Array.from(container.querySelectorAll('input[name="source"]:checked')).map((c) => c.value);
          const limit = Math.min(500, Math.max(10, parseInt(container.querySelector("#dt-limit").value, 10) || 100));
          data = await apiRun("theharvester", { domain, sources: sources.length ? sources : ["duckduckgo"], limit });
        }
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
    const fullLog = "[+] Домен: " + domain + "\n[+] Инструменты: " + selectedTools.join(", ") + "\n\n" + logParts.join("\n\n");
    terminalEl.textContent = fullLog;

    renderResultsCards(resultsEl, sections);

    btnRun.textContent = btnText;
    btnRun.disabled = false;
    btnRun.classList.remove("is-loading");
  });
}
