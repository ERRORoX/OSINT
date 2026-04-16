/**
 * Общие функции для вывода результатов: карточки с копированием, сводкой, кликабельными ссылками.
 */

export function escapeHtml(s) {
  if (s == null) return "";
  const t = String(s);
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Обрезает хвостовую пунктуацию с конца URL (скобки, точка, запятая и т.д.). */
function trimUrlTrailingPunctuation(url) {
  return url.replace(/[.,;:!?)}\]>]+$/, "");
}

/** Делает URL в тексте кликабельными (текст уже экранирован через escapeHtml при вставке в linkify). */
export function linkify(text) {
  if (!text || typeof text !== "string") return "";
  const escaped = escapeHtml(text);
  const urlRe = /(https?:\/\/[^\s<>"']+)/g;
  return escaped.replace(urlRe, (url) => {
    const trimmed = trimUrlTrailingPunctuation(url);
    const safe = trimmed.replace(/"/g, "&quot;");
    return `<a href="${safe}" target="_blank" rel="noopener" class="result-link">${trimmed}</a>`;
  });
}

/** Краткая сводка по выводу: число строк, пример первого результата. */
export function getOutputSummary(output) {
  if (!output || typeof output !== "string") return "";
  const trimmed = output.trim();
  if (!trimmed || trimmed === "(нет вывода)") return "Пусто";
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const lineCount = lines.length;
  if (lineCount <= 0) return "Пусто";
  const firstLine = lines[0].trim().slice(0, 60);
  if (lineCount === 1) return firstLine + (lines[0].length > 60 ? "…" : "");
  return `${lineCount} строк`;
}

/**
 * Строит HTML одной карточки результата: заголовок, сводка, кнопка «Копировать», прокручиваемый контент с ссылками.
 * @param {{ title: string, output: string, success: boolean }} section
 * @returns {string}
 */
export function renderResultCard(section) {
  const { title, output, success } = section;
  const raw = (output || "").trim() || "(нет вывода)";
  const summary = getOutputSummary(raw);
  const contentHtml = linkify(raw);
  const cardId = "result-" + Math.random().toString(36).slice(2, 9);
  return `
    <div class="tool-results-card tool-google-osint-block osint-card-hover card-appear ${success ? "success" : "error"}" data-card-id="${cardId}">
      <div class="tool-results-card__header">
        <h3 class="tool-results-card__title">${escapeHtml(title)}</h3>
        <span class="tool-results-card__summary">${escapeHtml(summary)}</span>
        <button type="button" class="btn btn-results-copy" title="Копировать вывод" data-copy-for="${cardId}">Копировать</button>
      </div>
      <div class="tool-results-card__content">
        <pre class="tool-results-card__pre">${contentHtml}</pre>
      </div>
    </div>
  `;
}

/**
 * Вставляет карточки в контейнер и вешает обработчик копирования.
 * @param {Element} container - элемент с id (например dt-results, ut-results, go-results)
 * @param {{ id: string, title: string, output: string, success: boolean }[]} sections
 */
export function renderResultsCards(container, sections) {
  if (!container) return;
  container.innerHTML = sections.map(renderResultCard).join("");

  container.querySelectorAll(".btn-results-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cardId = btn.dataset.copyFor;
      const card = container.querySelector(`[data-card-id="${cardId}"]`);
      const pre = card?.querySelector(".tool-results-card__pre");
      const text = pre ? pre.innerText || pre.textContent : "";
      navigator.clipboard.writeText(text).then(
        () => {
          const prev = btn.textContent;
          btn.textContent = "Скопировано";
          btn.classList.add("is-copied");
          setTimeout(() => {
            btn.textContent = prev;
            btn.classList.remove("is-copied");
          }, 1500);
        },
        () => {
          btn.textContent = "Ошибка";
        }
      );
    });
  });
}
