/** Карточка публичной/локальной ссылки: копирование. */
import { state } from "../state.js";
import { copyToClipboard } from "../utils.js";

export function initLink(container, showCopyFeedback) {
  const resultEl = container.querySelector("#gc-result");
  const copyBtn = container.querySelector("#gc-copy-btn");
  if (!copyBtn) return;
  copyBtn.addEventListener("click", () => {
    const url = copyBtn.getAttribute("data-copy") || resultEl?.querySelector("a.gc-link-url")?.href || "";
    if (!url) return;
    copyToClipboard(url)
      .then(() => showCopyFeedback("Ссылка скопирована."))
      .catch(() => showCopyFeedback("Не удалось скопировать ссылку."));
  });
}
