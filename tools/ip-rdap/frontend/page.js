(() => {
  "use strict";
  const form = document.getElementById("iprdap-form");
  const input = document.getElementById("ip-address");
  const result = document.getElementById("ip-result");
  const button = document.getElementById("ip-submit");
  const status = document.getElementById("ip-status");
  const graphStatus = document.getElementById("ip-graph-status");
  const copyButton = document.getElementById("ip-copy");
  if (!form || !input || !result || !button || !status || !graphStatus || !copyButton) return;

  let requestId = 0;
  let lastOutput = "";

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state || "idle";
  }

  function stableId(type, value) {
    let hash = 2166136261;
    const source = String(value || "").trim().toLowerCase();
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return type + ":" + (hash >>> 0).toString(16).padStart(8, "0");
  }

  function extractField(output, label) {
    const prefix = label.toLowerCase() + ":";
    const line = String(output || "").split("\n").find((item) => item.trim().toLowerCase().startsWith(prefix));
    return line ? line.slice(line.indexOf(":") + 1).trim() : "";
  }

  async function saveToGraph(ip, output) {
    const organization = extractField(output, "Организация");
    const network = extractField(output, "Сеть");
    const country = extractField(output, "Страна");
    const cidr = extractField(output, "CIDR");
    const ipId = stableId("ip", ip);
    const nodes = [{
      id: ipId,
      type: "ip",
      label: ip,
      details: ["Источник: IP Registry / RDAP", network && "Сеть: " + network, cidr && "CIDR: " + cidr, country && "Страна: " + country, organization && organization !== "не указана" && "Организация: " + organization].filter(Boolean).join("\n")
    }];
    const edges = [];
    if (organization && organization !== "не указана" && organization !== "—") {
      const orgId = stableId("organization", organization);
      nodes.push({
        id: orgId,
        type: "organization",
        label: organization.slice(0, 180),
        details: "Организация-владелец сети по данным RDAP. Страна: " + (country || "—") + "."
      });
      edges.push({ source: ipId, target: orgId, label: "регистрация сети" });
    }
    const response = await fetch("/api/graph/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ nodes, edges })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не удалось сохранить IP в графе.");
    return { nodes: nodes.length, edges: edges.length, total: Array.isArray(data.nodes) ? data.nodes.length : null };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ip = input.value.trim();
    if (!ip) {
      setStatus("Введите IP-адрес.", "error");
      input.focus();
      return;
    }
    const currentRequest = ++requestId;
    button.disabled = true;
    copyButton.disabled = true;
    lastOutput = "";
    result.textContent = "Получение регистрационных данных…";
    setStatus("Выполняется запрос к RDAP", "loading");
    graphStatus.textContent = "Граф расследований: ожидание успешного результата RDAP.";

    try {
      const response = await fetch("/api/tools/ip-rdap/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ ip })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "Не удалось выполнить RDAP-запрос.");
      if (currentRequest !== requestId) return;

      lastOutput = String(data.output || "").trim() || "RDAP вернул пустой ответ.";
      result.textContent = lastOutput;
      copyButton.disabled = !lastOutput;
      setStatus("Регистрационные сведения получены", "success");

      try {
        const saved = await saveToGraph(ip, lastOutput);
        if (currentRequest !== requestId) return;
        graphStatus.textContent = "Граф расследований: IP сохранён" +
          (saved.edges ? " вместе со связью с организацией" : "") +
          (saved.total !== null ? ". Всего узлов в графе: " + saved.total : ".") +
          " Откройте главный экран → Граф расследований.";
        graphStatus.dataset.state = "success";
      } catch (graphError) {
        if (currentRequest !== requestId) return;
        graphStatus.textContent = "RDAP-поиск выполнен, но сохранить запись в граф не удалось: " + (graphError.message || "ошибка сервера");
        graphStatus.dataset.state = "error";
      }
    } catch (error) {
      if (currentRequest !== requestId) return;
      result.textContent = error.message || "Не удалось выполнить запрос.";
      setStatus("Проверка не выполнена", "error");
      graphStatus.textContent = "Граф расследований не изменён: запись добавляется только после успешного RDAP-поиска.";
    } finally {
      if (currentRequest === requestId) button.disabled = false;
    }
  });

  copyButton.addEventListener("click", async () => {
    if (!lastOutput) return;
    try {
      await navigator.clipboard.writeText(lastOutput);
      copyButton.textContent = "Скопировано";
      window.setTimeout(() => { copyButton.textContent = "Копировать"; }, 1400);
    } catch {
      setStatus("Браузер не разрешил копирование. Выделите текст результата вручную.", "error");
    }
  });
})();