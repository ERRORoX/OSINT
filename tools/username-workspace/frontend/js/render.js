import { renderResultsCards } from "/js/tools/results-cards.js";
import { wireVerifyInPane } from "./verify.js";

export function setTabLoading(tabId, title) {
  const pane = document.getElementById("tab-" + tabId);
  if (!pane) return;
  pane.innerHTML = `
    <div class="tool-results-card tool-google-osint-block osint-card-hover" data-card-id="load-${tabId}">
      <div class="tool-results-card__header">
        <h3 class="tool-results-card__title">${title}</h3>
        <span class="tool-results-card__summary">Запуск…</span>
      </div>
      <div class="tool-results-card__content">
        <pre class="tool-results-card__pre">Параллельные запросы к API…</pre>
      </div>
    </div>
  `;
}

/**
 * Возвращает функцию рендера вкладки.
 * @param {{ getRenderer: () => (null | Function) }} opts
 */
export function createTabRenderer({ getRenderer }) {
  return function renderTabCard(tabId, title, text, ok) {
    const pane = document.getElementById("tab-" + tabId);
    if (!pane) return;
    const raw = (text || "").trim() || "(нет вывода)";

    const r = getRenderer();
    if (r) {
      r(pane, { tabId, output: raw, success: Boolean(ok) });
    } else {
      renderResultsCards(pane, [{ title, output: raw, success: Boolean(ok) }]);
    }

    wireVerifyInPane(pane);
  };
}

