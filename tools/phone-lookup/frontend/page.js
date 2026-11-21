(() => {
  "use strict";
  const form = document.getElementById("phone-form");
  const input = document.getElementById("phone-input");
  const button = document.getElementById("phone-submit");
  const output = document.getElementById("phone-output");
  const status = document.getElementById("phone-status");
  const copy = document.getElementById("phone-copy");
  if (!form || !input || !button || !output || !status || !copy) return;
  let lastOutput = "";
  let requestId = 0;
  const setStatus = (message, state) => { status.textContent = message; status.dataset.state = state || "idle"; };
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const phone = input.value.trim();
    if (!/^\\+[0-9().\\s-]{6,30}$/.test(phone)) {
      setStatus("Введите номер в международном формате, начиная с +.", "error");
      input.focus();
      return;
    }
    const current = ++requestId;
    button.disabled = true;
    copy.disabled = true;
    lastOutput = "";
    output.textContent = "Проверка номера по метаданным…";
    setStatus("Выполняется локальная проверка", "loading");
    try {
      const response = await fetch("/api/tools/phone-lookup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ phone })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "Не удалось проверить номер.");
      if (current !== requestId) return;
      lastOutput = String(data.output || "").trim();
      output.textContent = lastOutput || "Метаданные не получены.";
      copy.disabled = !lastOutput;
      setStatus("Метаданные получены", "success");
    } catch (error) {
      if (current !== requestId) return;
      output.textContent = error.message || "Ошибка проверки.";
      setStatus("Проверка не выполнена", "error");
    } finally {
      if (current === requestId) button.disabled = false;
    }
  });
  copy.addEventListener("click", async () => {
    if (!lastOutput) return;
    try { await navigator.clipboard.writeText(lastOutput); copy.textContent = "Скопировано"; }
    catch (_) { setStatus("Копирование недоступно в этом браузере.", "error"); }
  });
})();
