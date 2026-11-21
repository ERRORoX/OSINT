/**
 * Grabcam — панель OSINT. Точка входа: сборка из модулей (config, utils, layout, state, features).
 * Features подгружаются динамически, чтобы панель отображалась даже при ошибке в одном из них.
 * Автор инструмента: ERRORoX
 */
import { buildPanelHTML } from "./modules/layout.js";
import { clearAllPolls } from "./modules/utils.js";
import { API, POLL_IDS, POLL_INTERVALS } from "./modules/config.js";
import { state } from "./modules/state.js";

const GRABCAM_CSS_HREF = "/grabcam/panel/css/tool-grabcam.css";

let grabcamCssPromise = null;

/** Стили Grabcam не в index.html — только при открытии вкладки, без конкуренции с остальными инструментами до этого. */
function ensureGrabcamStylesLoaded() {
  // Не считаем общий CSS-бандл признаком загрузки Grabcam:
  // он может существовать, но не содержит полный набор модульных стилей панели.
  if (document.querySelector(`link[href="${GRABCAM_CSS_HREF}"][data-osint-grabcam-bundle]`)) {
    return Promise.resolve();
  }
  if (!grabcamCssPromise) {
    grabcamCssPromise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = GRABCAM_CSS_HREF;
      link.dataset.osintGrabcamBundle = "1";
      link.onload = () => resolve();
      link.onerror = () => {
        grabcamCssPromise = null;
        reject(new Error("Не удалось загрузить стили Grabcam"));
      };
      document.head.appendChild(link);
    });
  }
  return grabcamCssPromise;
}

export function initPanel(container) {
  if (container.dataset.inited === "1") return;

  ensureGrabcamStylesLoaded()
    .then(() => {
      if (container.dataset.inited === "1") return;
      container.dataset.inited = "1";
      clearAllPolls();
      container.innerHTML = buildPanelHTML();
      runFeaturesAfterMount(container);
    })
    .catch((err) => {
      console.error(err);
      container.innerHTML =
        '<div class="tool-view tool-google-osint-page" style="padding:1.25rem;color:var(--error)">Не удалось подключить стили Grabcam. Проверьте путь <code>/grabcam/panel/css/</code> и перезагрузите страницу.</div>';
    });
}

function runFeaturesAfterMount(container) {
  (async function runFeatures() {
    try {
      const features = await import("./modules/features/index.js");
      const { showLink, pollStatus, showCopyFeedback } = features.initControl(container);
      features.initLink(container, showCopyFeedback);

      try {
        const res = await fetch(API.runStatus);
        const st = await res.json();
        if (st.started_at != null && typeof st.started_at === "number") {
          state.sessionStartTime = st.started_at * 1000;
        }
        const resultEl = container.querySelector("#gc-result");
        const submitBtn = container.querySelector("#gc-btn-start");
        const stopBtn = container.querySelector("#gc-btn-stop");
        const statusEl = container.querySelector("#gc-status");
        if (!st.running && st.error && statusEl) {
          statusEl.textContent = st.error;
        }
        if (st.running || st.link || st.local_url) {
          if (st.link || st.local_url) showLink(st.link || null, st.local_url || null);
          const statusToggle = container.querySelector("#gc-feat-status");
          if (statusToggle) statusToggle.checked = !!st.running;
          if (st.running && submitBtn && stopBtn && statusEl) {
            submitBtn.disabled = true;
            submitBtn.style.display = "none";
            stopBtn.style.display = "inline-block";
            statusEl.textContent = st.error || (st.link ? "Публичный туннель активен." : st.local_url ? "Локальный сервер активен." : "Ожидание ссылки туннеля…");
            POLL_IDS.status = setInterval(pollStatus, POLL_INTERVALS.status);
          }
          if (resultEl) {
            resultEl.classList.remove("gc-link-placeholder");
            if (st.link || st.local_url) resultEl.className = "gc-link-box gc-link-success";
          }
        }
      } catch (_) {}
    } catch (e) {
      console.error("Grabcam: ошибка загрузки модулей", e);
    }
  })();
}
