import { TOOL_DEFS } from "./consts.js";

export function progressCard(tab) {
  return document.querySelector(`[data-progress-tool="${tab}"]`);
}

export function setProgressPct(card, pct) {
  if (!card) return;
  const fill = card.querySelector(".js-progress-fill");
  const pctEl = card.querySelector(".js-progress-pct");
  const v = Math.max(0, Math.min(100, Number(pct)));
  if (fill) fill.style.width = `${v}%`;
  if (pctEl) pctEl.textContent = `${Math.round(v)}%`;
}

export function setProgressState(card, { pct, status, mode }) {
  if (!card) return;
  card.classList.remove("is-waiting", "is-running", "is-done", "is-error", "is-skipped");

  if (mode === "skipped") {
    card.classList.add("is-skipped");
    const f0 = card.querySelector(".js-progress-fill");
    if (f0) f0.style.transform = "";
    setProgressPct(card, 0);
    const st = card.querySelector(".js-progress-status");
    if (st) st.textContent = status || "Выключен";
    return;
  }
  if (mode === "waiting") {
    card.classList.add("is-waiting");
    const f0 = card.querySelector(".js-progress-fill");
    if (f0) f0.style.transform = "";
    setProgressPct(card, 0);
    const st = card.querySelector(".js-progress-status");
    if (st) st.textContent = status || "В очереди";
    return;
  }
  if (mode === "running") {
    card.classList.add("is-running");
    const fill = card.querySelector(".js-progress-fill");
    if (fill) {
      fill.style.width = "";
      fill.style.transform = "";
    }
    const pctEl = card.querySelector(".js-progress-pct");
    if (pctEl) pctEl.textContent = "…";
    const st = card.querySelector(".js-progress-status");
    if (st) st.textContent = status || "Выполняется…";
    return;
  }
  if (mode === "done") {
    card.classList.add("is-done");
    const fill = card.querySelector(".js-progress-fill");
    if (fill) fill.style.transform = "";
    setProgressPct(card, pct ?? 100);
    const st = card.querySelector(".js-progress-status");
    if (st) st.textContent = status || "Готово";
    return;
  }
  if (mode === "error") {
    card.classList.add("is-error");
    const fill = card.querySelector(".js-progress-fill");
    if (fill) fill.style.transform = "";
    setProgressPct(card, pct ?? 100);
    const st = card.querySelector(".js-progress-status");
    if (st) st.textContent = status || "Ошибка";
  }
}

export function resetProgressPanel(enabledSet) {
  TOOL_DEFS.forEach((t) => {
    const card = progressCard(t.tab);
    if (!card) return;
    if (!enabledSet.has(t.tab)) {
      setProgressState(card, { mode: "skipped", status: "Модуль выключен" });
    } else {
      setProgressState(card, { mode: "running", pct: 8, status: "Запрос к API (параллельно)…" });
    }
  });
}

export function showProgressPanel(show) {
  const el = document.getElementById("usernameProgress");
  if (!el) return;
  el.style.display = show ? "block" : "none";
}

