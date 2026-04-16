/**
 * Панель Google OSINT: email — Holehe и h8mail, все ответы в одной панели.
 */
import { apiRun } from "../app-core.js";
import { renderResultsCards } from "./results-cards.js";

const TOOL_ID = "google-osint";

function analyzeText(raw) {
  const t = String(raw || "");
  const low = t.toLowerCase();
  const flags = [];
  if (t.includes("Traceback (most recent call last):") || /ModuleNotFoundError|ImportError|SyntaxError/.test(t)) flags.push("traceback");
  if (/timeout|timed out|превышено время ожидания|read timed out/.test(low)) flags.push("timeout");
  if (/429|too many requests|rate limit|blocked|captcha/.test(low)) flags.push("ratelimit");
  if (/api key|apikey|hibp|hunter|ключ/i.test(t) && /not set|missing|отсутств|не задан/i.test(t)) flags.push("keys");
  return flags;
}

function countServicesLikeHolehe(raw) {
  // Holehe prints colored lines; we only have text. Heuristic:
  // count lines with [+] / [x] / [-] patterns referencing domains.
  const lines = String(raw || "").split(/\r?\n/);
  let used = 0;
  let checked = 0;
  for (const ln of lines) {
    const s = ln.trim();
    if (!s) continue;
    if (s.startsWith("[+]") || s.startsWith("[")) checked++;
    if (s.startsWith("[+]")) used++;
  }
  return { used, checked };
}

function countBreachesLikeH8mail(raw) {
  const t = String(raw || "");
  // common words in h8mail outputs: "Breach", "breaches", "pwned", "Found"
  const m = t.match(/\bBreach\b|\bbreach\b|\bpwned\b|\bfound\b/gi);
  return m ? Math.min(999, m.length) : 0;
}

function renderEmailSummary({ email, holehe, h8mail, wallSeconds }) {
  const hOut = (holehe?.output || "").trim();
  const bOut = (h8mail?.output || "").trim();
  const hFlags = analyzeText(hOut);
  const bFlags = analyzeText(bOut);
  const flags = [...new Set([...hFlags, ...bFlags])];
  const holeheCnt = countServicesLikeHolehe(hOut);
  const breachesCnt = countBreachesLikeH8mail(bOut);
  const keysPresent = h8mail?.keys_present;
  const keysHint = keysPresent === false ? " · ключи h8mail не заданы" : "";
  const flagText =
    flags.length === 0
      ? ""
      : ` · предупреждения: ${flags
          .map((f) => ({ traceback: "traceback", timeout: "timeout", ratelimit: "rate-limit", keys: "keys" }[f] || f))
          .join(", ")}`;
  return `
    <div class="go-summary">
      <div class="go-summary__row">
        <span class="go-pill"><strong>Email</strong> ${email}</span>
        <span class="go-pill"><strong>Holehe</strong> ${holeheCnt.used}${holeheCnt.checked ? `/${holeheCnt.checked}` : ""}</span>
        <span class="go-pill"><strong>h8mail</strong> ${breachesCnt}</span>
        <span class="go-pill"><strong>Время</strong> ${wallSeconds >= 10 ? wallSeconds.toFixed(1) : wallSeconds.toFixed(2)} c</span>
      </div>
      <div class="go-summary__hint">Сводка считается из реального текста вывода. ${keysHint}${flagText}</div>
    </div>
  `;
}

export function initPanel(container) {
  if (container.dataset.inited) return;
  container.dataset.inited = "1";
  container.innerHTML = `
    <div class="tool-google-osint-page tool-view">
      <section class="tool-view-section tool-view-section--search">
        <h2 class="tool-view-section__title">EMAIL SEARCH</h2>
        <p class="tool-cli-desc">Введите email — Holehe (сайты по email) и h8mail (утечки). Для h8mail добавьте API-ключи в «API ключи».</p>
        <form id="form-google-osint" class="tool-google-osint-form">
          <div class="form-group">
            <label for="go-email">Email</label>
            <input type="text" id="go-email" name="email" placeholder="user@gmail.com">
          </div>
          <div class="tool-google-osint-checkboxes">
            <label class="grabcam-feature-check"><input type="checkbox" name="run_holehe" id="go-run-holehe" checked> Holehe</label>
            <label class="grabcam-feature-check"><input type="checkbox" name="run_h8mail" id="go-run-h8mail" checked> h8mail</label>
          </div>
          <div class="tool-form-actions">
            <button type="submit" class="btn btn-primary" id="btn-go-run">SEARCH</button>
            <button type="button" class="btn btn-secondary" id="btn-go-clear">CLEAR</button>
          </div>
        </form>
      </section>
      <section class="tool-view-section tool-view-section--terminal">
        <h2 class="tool-view-section__title">LIVE TERMINAL</h2>
        <div id="go-terminal" class="tool-terminal" role="log"></div>
        <div id="go-status" class="tool-cli-status" role="status"></div>
      </section>
      <section class="tool-view-section tool-view-section--results">
        <h2 class="tool-view-section__title">RESULTS OVERVIEW</h2>
        <div id="go-results" class="tool-google-osint-results tool-results-overview"></div>
      </section>
    </div>
  `;

  const form = container.querySelector("#form-google-osint");
  const statusEl = container.querySelector("#go-status");
  const terminalEl = container.querySelector("#go-terminal");
  const resultsEl = container.querySelector("#go-results");
  const btn = container.querySelector("#btn-go-run");
  const btnClear = container.querySelector("#btn-go-clear");
  if (btnClear) btnClear.addEventListener("click", () => {
    form.querySelector("#go-email").value = "";
    terminalEl.textContent = "";
    statusEl.textContent = "";
    statusEl.className = "tool-cli-status";
    resultsEl.innerHTML = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (form.querySelector("#go-email").value || "").trim();
    const run_holehe = form.querySelector("#go-run-holehe").checked;
    const run_h8mail = form.querySelector("#go-run-h8mail").checked;

    if (!email || !email.includes("@")) {
      statusEl.textContent = "Укажите email.";
      statusEl.className = "tool-cli-status error";
      return;
    }
    statusEl.className = "tool-cli-status";
    statusEl.textContent = "";

    const btnText = btn.textContent;
    btn.textContent = "Подождите…";
    btn.disabled = true;
    btn.classList.add("is-loading");
    statusEl.textContent = "Запуск…";
    terminalEl.textContent = "[+] Searching for email: " + email + "\n[+] Running Holehe, h8mail…";
    resultsEl.innerHTML = "";

    try {
      const wallT0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      const data = await apiRun(TOOL_ID, {
        email,
        run_holehe,
        run_h8mail,
      });
      const wallMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - wallT0;
      const wallSeconds = wallMs / 1000;

      statusEl.className = "tool-cli-status " + (data.success ? "" : "error");
      statusEl.textContent = data.success ? "Готово." : (data.error || "Часть проверок завершилась с ошибками.");
      const results = data.results || {};
      const sections = [
        { key: "holehe", title: "Holehe (сайты по email)" },
        { key: "h8mail", title: "h8mail (утечки)" },
      ];
      const logParts = sections.map(({ key, title }) => {
        const r = results[key] || {};
        const out = (r.output || "").trim() || "(нет вывода)";
        return `========== ${title} ==========\n${out}`;
      });
      const fullLog = logParts.join("\n\n");
      terminalEl.textContent = "[+] Email: " + email + "\n" + fullLog;

      const cardsData = sections.map(({ key, title }) => {
        const r = results[key] || {};
        const rawOut = (r.output || "").trim();
        const durMs = r.stats && typeof r.stats.duration_ms === "number" ? r.stats.duration_ms : 0;
        const dur = durMs ? ` (${(durMs / 1000).toFixed(durMs >= 10000 ? 1 : 2)}с)` : "";
        return { id: key, title, output: rawOut || "(нет вывода)", success: r.success };
      });
      resultsEl.innerHTML = renderEmailSummary({ email, holehe: results.holehe, h8mail: results.h8mail, wallSeconds }) + `<div class="go-cards"></div>`;
      renderResultsCards(resultsEl.querySelector(".go-cards"), cardsData);
    } catch (err) {
      statusEl.className = "tool-cli-status error";
      statusEl.textContent = err.message || "Ошибка запроса.";
      terminalEl.textContent = (terminalEl.textContent || "") + "\n[!] " + (err.message || "Ошибка сети");
      resultsEl.innerHTML = "";
    }
    btn.textContent = btnText;
    btn.disabled = false;
    btn.classList.remove("is-loading");
  });
}
