/**
 * Панель «Помощник» — ИИ-агент для OSINT/Pentest: чат и подсказки «что делать дальше».
 */
const API = "/api";

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatMessageContent(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

export function initPanel(container) {
  if (container.dataset.inited) return;
  container.dataset.inited = "1";
  container.innerHTML = `
    <div class="tool-view ai-agent-page">
      <section class="ai-agent-header glass-card">
        <div class="card-header"><span>Помощник</span></div>
        <div class="glass-card-content">
          <h2 class="tool-view-section__title">ПОМОЩНИК (AI AGENT)</h2>
          <p class="ai-agent-desc">Полноценный автономный агент: задайте цель — ИИ сам запустит нужные инструменты по очереди и выдаст итог. Также доступны чат и подсказки. Укажите OpenAI API Key или OLLAMA_URL в настройках.</p>
          <div id="ai-agent-status" class="ai-agent-status" role="status"></div>
        </div>
      </section>
      <section class="ai-agent-automate glass-card">
        <div class="card-header"><span>Автоматизация</span></div>
        <div class="glass-card-content">
          <h3 class="ai-agent-automate-title">Автоматический сценарий</h3>
          <p class="ai-agent-automate-desc">Опишите цель одной фразой — агент сам выберет и запустит инструменты (домен, ник, email).</p>
          <div class="ai-agent-automate-form">
            <textarea id="ai-agent-goal" rows="2" placeholder="Например: Полная разведка по домену example.com / Найти все аккаунты по нику john_doe"></textarea>
            <div class="ai-agent-automate-opts">
              <label>Макс. шагов <input type="number" id="ai-agent-max-steps" value="10" min="1" max="15"></label>
              <button type="button" class="btn btn-primary" id="ai-agent-run-automate">Выполнить автоматически</button>
            </div>
          </div>
          <div id="ai-agent-automate-log" class="ai-agent-automate-log" role="log"></div>
          <div id="ai-agent-automate-error" class="ai-agent-error" role="alert"></div>
        </div>
      </section>
      <section class="ai-agent-context glass-card">
        <div class="card-header"><span>Контекст</span></div>
        <div class="glass-card-content">
          <label for="ai-agent-context">Контекст (цель, что уже сделали, фрагмент вывода):</label>
          <textarea id="ai-agent-context" rows="3" placeholder="Например: Домен example.com, запустил theHarvester и Subfinder, найдено 12 поддоменов и 3 email"></textarea>
          <button type="button" class="btn btn-secondary" id="ai-agent-suggest">Подсказать следующие шаги</button>
        </div>
      </section>
      <section class="ai-agent-chat glass-card">
        <div class="card-header"><span>Чат</span></div>
        <div class="glass-card-content ai-agent-chat-inner">
          <div id="ai-agent-messages" class="ai-agent-messages" role="log"></div>
          <div class="ai-agent-input-row">
            <input type="text" id="ai-agent-input" placeholder="Задайте вопрос или опишите задачу..." autocomplete="off">
            <button type="button" class="btn btn-primary" id="ai-agent-send">Отправить</button>
          </div>
          <div id="ai-agent-chat-error" class="ai-agent-error" role="alert"></div>
        </div>
      </section>
    </div>
  `;

  const statusEl = container.querySelector("#ai-agent-status");
  const goalEl = container.querySelector("#ai-agent-goal");
  const maxStepsEl = container.querySelector("#ai-agent-max-steps");
  const runAutomateBtn = container.querySelector("#ai-agent-run-automate");
  const automateLogEl = container.querySelector("#ai-agent-automate-log");
  const automateErrorEl = container.querySelector("#ai-agent-automate-error");
  const contextEl = container.querySelector("#ai-agent-context");
  const suggestBtn = container.querySelector("#ai-agent-suggest");
  const messagesEl = container.querySelector("#ai-agent-messages");
  const inputEl = container.querySelector("#ai-agent-input");
  const sendBtn = container.querySelector("#ai-agent-send");
  const chatErrorEl = container.querySelector("#ai-agent-chat-error");

  let chatHistory = [];

  runAutomateBtn.addEventListener("click", async () => {
    const goal = (goalEl.value || "").trim();
    if (!goal) {
      automateErrorEl.textContent = "Введите цель (например: разведай домен example.com).";
      automateErrorEl.style.display = "block";
      return;
    }
    const maxSteps = Math.max(1, Math.min(15, parseInt(maxStepsEl.value, 10) || 10));
    runAutomateBtn.disabled = true;
    automateErrorEl.style.display = "none";
    automateLogEl.innerHTML = "<p class='ai-agent-automate-running'>Выполняю… Агент запускает инструменты по очереди. Подождите.</p>";
    try {
      const res = await fetch(`${API}/ai/automate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, max_steps: maxSteps }),
      });
      const data = await res.json();
      let html = "";
      if (data.steps && data.steps.length) {
        html += "<ul class='ai-agent-steps-list'>";
        data.steps.forEach((s, i) => {
          const status = s.success ? "успех" : "ошибка";
          const params = typeof s.params === "object" && s.params !== null ? JSON.stringify(s.params) : "";
          html += `<li class="ai-agent-step ai-agent-step--${s.success ? 'ok' : 'err'}">
            <strong>Шаг ${i + 1}: ${escapeHtml(s.tool_id)}</strong> ${escapeHtml(params)} — ${status}
            ${s.error ? `<br><span class="ai-agent-step-error">${escapeHtml(s.error)}</span>` : ""}
            ${s.output_preview ? `<pre class="ai-agent-step-output">${escapeHtml(s.output_preview.slice(0, 500))}${s.output_preview.length > 500 ? "…" : ""}</pre>` : ""}
          </li>`;
        });
        html += "</ul>";
      }
      if (data.summary) {
        html += `<div class="ai-agent-summary"><strong>Итог:</strong><p>${formatMessageContent(data.summary)}</p></div>`;
      }
      automateLogEl.innerHTML = html || "<p>Нет шагов.</p>";
    } catch (e) {
      automateErrorEl.textContent = e.message || "Ошибка сети.";
      automateErrorEl.style.display = "block";
      automateLogEl.innerHTML = "";
    }
    runAutomateBtn.disabled = false;
  });

  async function checkStatus() {
    try {
      const res = await fetch(`${API}/ai/status`);
      const data = await res.json();
      if (data.available) {
        statusEl.textContent = "ИИ доступен.";
        statusEl.className = "ai-agent-status ok";
      } else {
        statusEl.textContent = "ИИ не настроен. Укажите AI_OPENAI_API_KEY или OLLAMA_URL в настройках.";
        statusEl.className = "ai-agent-status warning";
      }
    } catch {
      statusEl.textContent = "Не удалось проверить статус ИИ.";
      statusEl.className = "ai-agent-status warning";
    }
  }

  function appendMessage(role, content) {
    const div = document.createElement("div");
    div.className = "ai-agent-msg ai-agent-msg--" + role;
    div.setAttribute("aria-label", role === "user" ? "Вы" : "Помощник");
    const inner = document.createElement("div");
    inner.className = "ai-agent-msg__content";
    inner.innerHTML = formatMessageContent(content);
    div.appendChild(inner);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setChatError(msg) {
    chatErrorEl.textContent = msg || "";
    chatErrorEl.style.display = msg ? "block" : "none";
  }

  suggestBtn.addEventListener("click", async () => {
    const context = (contextEl.value || "").trim();
    suggestBtn.disabled = true;
    suggestBtn.textContent = "Запрос…";
    setChatError("");
    try {
      const res = await fetch(`${API}/ai/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: context || "Пользователь не ввёл контекст." }),
      });
      const data = await res.json();
      if (data.success && data.reply) {
        appendMessage("user", "[Подсказки по контексту]" + (context ? "\nКонтекст: " + context : ""));
        appendMessage("assistant", data.reply);
        chatHistory.push({ role: "user", content: "[Подсказки по контексту]" });
        chatHistory.push({ role: "assistant", content: data.reply });
      } else {
        setChatError(data.error || "Ошибка запроса подсказок.");
      }
    } catch (e) {
      setChatError(e.message || "Ошибка сети.");
    }
    suggestBtn.disabled = false;
    suggestBtn.textContent = "Подсказать следующие шаги";
  });

  async function sendMessage() {
    const message = (inputEl.value || "").trim();
    if (!message) return;
    inputEl.value = "";
    sendBtn.disabled = true;
    appendMessage("user", message);
    setChatError("");
    const context = (contextEl.value || "").trim();
    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context,
          history: chatHistory,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const runs = data.tool_runs || [];
        if (runs.length > 0) {
          const runSummary = runs.map((r) => {
            const p = r.params && typeof r.params === "object" ? (r.params.domain || r.params.username || r.params.query || r.params.ip || JSON.stringify(r.params)) : "";
            return r.tool_id + (p ? `(${p})` : "");
          }).join(", ");
          appendMessage("assistant", "Выполнено: " + runSummary + (data.reply ? "\n\n" + data.reply : ""));
        } else if (data.reply) {
          appendMessage("assistant", data.reply);
        }
        const fullReply = (runs.length ? "Выполнено: " + runs.map((r) => r.tool_id).join(", ") + "\n\n" : "") + (data.reply || "");
        chatHistory.push({ role: "user", content: message });
        chatHistory.push({ role: "assistant", content: fullReply });
      } else {
        setChatError(data.error || "Ошибка ответа ИИ.");
      }
    } catch (e) {
      setChatError(e.message || "Ошибка сети.");
    }
    sendBtn.disabled = false;
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  checkStatus();
}
