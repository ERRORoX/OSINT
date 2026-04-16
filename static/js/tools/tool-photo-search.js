/**
 * Поиск по фото: загрузка / вставка → анализ (EXIF, GPS, хэши, энтропия) → reverse image search.
 */
import { apiRun } from "../app-core.js";

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

const ICON_CAMERA =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

const EXIF_SUMMARY_RU = {
  Make: "Производитель камеры",
  Model: "Модель",
  LensModel: "Объектив",
  Software: "ПО обработки",
  DateTime: "Дата/время (файл)",
  DateTimeOriginal: "Дата съёмки",
  DateTimeDigitized: "Дата оцифровки",
  Artist: "Автор",
  Copyright: "Авторские права",
  Orientation: "Ориентация",
  ISOSpeedRatings: "ISO",
  PhotographicSensitivity: "Светочувствительность",
  ExposureTime: "Выдержка",
  FNumber: "Диафрагма (f)",
  FocalLength: "Фокусное расстояние",
  Flash: "Вспышка",
  WhiteBalance: "Баланс белого",
  ImageUniqueID: "ID изображения",
  BodySerialNumber: "Серийный номер корпуса",
};

function bytesHuman(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(2)} MB`;
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.readAsDataURL(file);
  });
}

function formatVal(v) {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function metaRows(meta) {
  const rows = [
    ["Файл", meta.filename || "—"],
    ["Формат (PIL)", meta.format || "—"],
    ["MIME (сигнатура)", meta.mime_detected || "—"],
    ["Размер", meta.width && meta.height ? `${meta.width}×${meta.height} px` : "—"],
    ["Мегапиксели", meta.megapixels != null ? String(meta.megapixels) : "—"],
    ["Режим", meta.mode || "—"],
    ["Кадров", meta.frame_count != null ? String(meta.frame_count) : "—"],
    ["Анимация", meta.animated ? "да" : "нет"],
    ["Альфа-канал", meta.has_alpha ? "да" : "нет"],
    ["ICC-профиль", meta.has_icc_profile ? "да" : "нет"],
    ["XMP", meta.has_xmp ? "да" : "нет"],
    ["Размер файла", meta.bytes != null ? bytesHuman(meta.bytes) : "—"],
  ];
  if (meta.dpi != null && meta.dpi !== "") rows.push(["DPI", formatVal(meta.dpi)]);
  if (meta.compression != null && meta.compression !== "") rows.push(["Сжатие", formatVal(meta.compression)]);
  return rows;
}

function kvHtml(rows) {
  const parts = rows.map(
    ([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`
  );
  return `<dl class="ps-kv">${parts.join("")}</dl>`;
}

/** Кнопки копирования: значения — hex, безопасны для data-copy */
function hashRowsSafe(hashes, perceptual) {
  const all = { ...hashes, ...perceptual };
  return Object.entries(all).map(([name, val]) => {
    const s = String(val);
    return `<div class="ps-hash-row"><code>${escapeHtml(name)}: ${escapeHtml(s)}</code><button type="button" class="ps-copy" data-copy="${escapeHtml(s)}">Копировать</button></div>`;
  });
}

function summaryRows(summary) {
  const keys = Object.keys(summary || {});
  if (!keys.length) return [];
  return keys.map((k) => [
    EXIF_SUMMARY_RU[k] || k,
    formatVal(summary[k]),
  ]);
}

function reverseLinksCard() {
  const links = [
    ["Google Lens", "https://lens.google.com/"],
    ["Яндекс.Картинки", "https://yandex.ru/images/"],
    ["Bing Visual", "https://www.bing.com/visualsearch"],
    ["TinEye", "https://tineye.com/"],
    ["SauceNAO", "https://saucenao.com/"],
    ["IQDB (аниме/арт)", "https://iqdb.org/"],
    ["Baidu Images", "https://image.baidu.com/"],
  ];
  const btns = links
    .map(
      ([t, href]) =>
        `<a class="btn btn-secondary" target="_blank" rel="noopener noreferrer" href="${escapeHtml(href)}">${escapeHtml(t)}</a>`
    )
    .join("");
  return `
    <div class="tool-results-card tool-google-osint-block success">
      <div class="tool-results-card__header">
        <h3 class="tool-results-card__title">Reverse Image Search</h3>
        <span class="tool-results-card__summary">внешние сервисы</span>
      </div>
      <div class="tool-results-card__content">
        <div style="color:var(--text-muted);font-size:12px;line-height:1.55">
          Полноценная автозагрузка из браузера часто блокируется политиками сайтов. Откройте сервис и загрузите файл вручную или вставьте скриншот.
        </div>
        <div class="ps-links-grid">${btns}</div>
      </div>
    </div>
  `;
}

function exiftoolSection(ext) {
  if (ext == null) return "";
  if (ext.skipped) {
    return `
      <div class="tool-results-card tool-google-osint-block">
        <div class="tool-results-card__header">
          <h3 class="tool-results-card__title">ExifTool (расширенно)</h3>
          <span class="tool-results-card__summary">не использовано</span>
        </div>
        <div class="tool-results-card__content ps-exiftool-skip">${escapeHtml(ext.error || "—")}</div>
        </div>`;
  }
  if (!ext.ok) {
    return `<div class="tool-results-card tool-google-osint-block error">
      <div class="tool-results-card__header">
        <h3 class="tool-results-card__title">ExifTool</h3>
        <span class="tool-results-card__summary">ошибка</span>
      </div>
      <div class="tool-results-card__content">${escapeHtml(ext.error || "Ошибка")}</div>
    </div>`;
  }
  const det = ext.detective_report || "";
  const fmt = ext.formatted_text || "";
  const rec = ext.record || {};
  let recJson = "";
  try {
    recJson = JSON.stringify(rec, null, 2);
  } catch {
    recJson = "{}";
  }
  const trunc = ext.record_truncated ? " (часть тегов обрезана)" : "";
  return `
    <div class="tool-results-card tool-google-osint-block success">
      <div class="tool-results-card__header">
        <h3 class="tool-results-card__title">Разбор метаданных (ExifTool)</h3>
        <span class="tool-results-card__summary">${escapeHtml(String(ext.tag_count || 0))} тегов${trunc}</span>
      </div>
      <div class="tool-results-card__content">
        <pre class="tool-results-card__pre ps-exiftool-pre">${escapeHtml(det)}</pre>
      </div>
    </div>
    <div class="tool-results-card tool-google-osint-block success">
      <div class="tool-results-card__header">
        <h3 class="tool-results-card__title">Категории метаданных (ExifTool)</h3>
        <span class="tool-results-card__summary">текст</span>
      </div>
      <div class="tool-results-card__content">
        <details><summary class="ps-details-sum">Развернуть</summary>
        <pre class="tool-results-card__pre ps-exiftool-pre">${escapeHtml(fmt)}</pre></details>
      </div>
    </div>
    <div class="tool-results-card tool-google-osint-block success">
      <div class="tool-results-card__header">
        <h3 class="tool-results-card__title">Сырой дамп ExifTool (JSON)</h3>
        <span class="tool-results-card__summary">${escapeHtml(String(Object.keys(rec).length))} полей</span>
      </div>
      <div class="tool-results-card__content">
        <details><summary class="ps-details-sum">Развернуть</summary>
        <pre class="tool-results-card__pre ps-exiftool-json">${escapeHtml(recJson)}</pre></details>
      </div>
    </div>
  `;
}

function gpsBlock(gps) {
  if (!gps || typeof gps !== "object") return "";
  const lat = gps.latitude;
  const lon = gps.longitude;
  if (lat != null && lon != null) {
    const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
    const gmaps = `https://www.google.com/maps?q=${lat},${lon}`;
    return `
      <div class="ps-gps" role="status">
        <strong>GPS в метаданных</strong> — ${escapeHtml(gps.note || "")}<br/>
        Широта: <code>${escapeHtml(String(lat))}</code>, долгота: <code>${escapeHtml(String(lon))}</code><br/>
        <span style="margin-top:8px;display:inline-flex;gap:8px;flex-wrap:wrap">
          <a href="${escapeHtml(osm)}" target="_blank" rel="noopener noreferrer">Открыть в OpenStreetMap</a>
          <a href="${escapeHtml(gmaps)}" target="_blank" rel="noopener noreferrer">Google Maps</a>
        </span>
      </div>
    `;
  }
  if (gps.note) {
    return `<div class="ps-gps" role="status">${escapeHtml(gps.note)}</div>`;
  }
  return "";
}

export function initPanel(container) {
  if (container.dataset.inited) return;
  container.dataset.inited = "1";
  container.innerHTML = `
    <div class="tool-view tool-google-osint-page">
      <section class="tool-view-section glass-card">
        <div class="card-header"><span>Фото</span></div>
        <div class="glass-card-content">
          <h2 class="tool-view-section__title">ПОИСК ПО ФОТОГРАФИИ</h2>
          <p class="tool-cli-desc">Загрузите изображение или вставьте его из буфера (Ctrl+V). Панель извлечёт EXIF, оценит энтропию файла и посчитает хэши. Для поиска копий используйте ссылки на внешние сервисы ниже.</p>

          <div class="photo-uploader" id="ps-uploader" tabindex="0">
            ${ICON_CAMERA}
            <div class="label">Перетащите фото или нажмите для загрузки</div>
            <div class="sublabel">JPG / PNG / WebP / GIF — до 12 MB</div>
            <input type="file" id="ps-file" accept="image/*" style="display:none" />
          </div>
          <p class="ps-paste-hint" id="ps-paste-hint">Подсказка: скопируйте картинку в буфер и нажмите Ctrl+V на этой странице (когда открыта вкладка «Фото»).</p>

          <div id="ps-preview-wrap" style="display:none">
            <img id="ps-preview" class="photo-preview" alt="Предпросмотр" />
          </div>

          <div class="ps-options">
            <label class="ps-opt-label">
              <input type="checkbox" id="ps-exiftool" checked />
              Расширенный анализ (ExifTool)
            </label>
            <label class="ps-opt-label" title="Обратное геокодирование через Nominatim (внешняя сеть, действуйте в рамках правил OSM)">
              <input type="checkbox" id="ps-geocode" />
              Геокодирование GPS
            </label>
          </div>

          <div class="tool-form-actions">
            <button type="button" class="btn btn-primary" id="ps-analyze">Анализ</button>
            <button type="button" class="btn btn-secondary" id="ps-reset">Сброс</button>
          </div>
          <div id="ps-status" class="tool-cli-status" role="status"></div>
        </div>
      </section>

      <section class="tool-view-section glass-card">
        <div class="card-header"><span>Результаты</span></div>
        <div class="glass-card-content">
          <div id="ps-results" class="tool-results-overview"></div>
        </div>
      </section>
    </div>
  `;

  const uploader = container.querySelector("#ps-uploader");
  const fileInput = container.querySelector("#ps-file");
  const previewWrap = container.querySelector("#ps-preview-wrap");
  const preview = container.querySelector("#ps-preview");
  const btnAnalyze = container.querySelector("#ps-analyze");
  const btnReset = container.querySelector("#ps-reset");
  const statusEl = container.querySelector("#ps-status");
  const resultsEl = container.querySelector("#ps-results");

  let file = null;
  let dataUrl = "";

  function setStatus(text, loading = false) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-loading", !!loading);
  }

  function reset() {
    file = null;
    dataUrl = "";
    fileInput.value = "";
    preview.src = "";
    previewWrap.style.display = "none";
    resultsEl.innerHTML = "";
    setStatus("");
    uploader.style.display = "";
  }

  async function setFile(f) {
    if (!f) return;
    if (!String(f.type || "").startsWith("image/")) {
      setStatus("Это не изображение.", false);
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setStatus("Файл слишком большой (лимит 12 MB).", false);
      return;
    }
    file = f;
    dataUrl = await readAsDataURL(file);
    preview.src = dataUrl;
    previewWrap.style.display = "block";
    uploader.style.display = "none";
    setStatus(`Файл: ${file.name} (${bytesHuman(file.size)})`, false);
  }

  async function setFromBlob(blob) {
    const f = new File([blob], "clipboard.png", { type: blob.type || "image/png" });
    await setFile(f);
  }

  uploader.addEventListener("click", () => fileInput.click());
  uploader.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  uploader.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploader.classList.add("drag-over");
  });
  uploader.addEventListener("dragleave", () => uploader.classList.remove("drag-over"));
  uploader.addEventListener("drop", async (e) => {
    e.preventDefault();
    uploader.classList.remove("drag-over");
    const f = e.dataTransfer?.files?.[0];
    await setFile(f);
  });
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    await setFile(f);
  });

  function onPaste(e) {
    if (!container.classList.contains("active")) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type && it.type.startsWith("image/")) {
        e.preventDefault();
        const blob = it.getAsFile();
        if (blob) void setFromBlob(blob);
        return;
      }
    }
  }
  window.addEventListener("paste", onPaste);

  btnReset.addEventListener("click", reset);

  resultsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ps-copy");
    if (!btn || !resultsEl.contains(btn)) return;
    const raw = btn.getAttribute("data-copy") || "";
    try {
      await navigator.clipboard.writeText(raw);
      const prev = btn.textContent;
      btn.textContent = "Скопировано";
      setTimeout(() => {
        btn.textContent = prev;
      }, 1400);
    } catch {
      btn.textContent = "Ошибка";
      setTimeout(() => {
        btn.textContent = "Копировать";
      }, 1400);
    }
  });

  btnAnalyze.addEventListener("click", async () => {
    if (!file || !dataUrl) {
      setStatus("Сначала загрузите фото или вставьте из буфера.", false);
      return;
    }
    btnAnalyze.disabled = true;
    setStatus("Анализирую…", true);
    resultsEl.innerHTML = "";
    try {
      const b64 = dataUrl.split(",")[1] || "";
      const useExiftool = container.querySelector("#ps-exiftool");
      const useGeocode = container.querySelector("#ps-geocode");
      const data = await apiRun("photo-search", {
        image_base64: b64,
        filename: file.name,
        exiftool: useExiftool ? useExiftool.checked : true,
        geocode: useGeocode ? !!useGeocode.checked : false,
      });
      if (!data.success) throw new Error(data.error || "Ошибка анализа");

      const meta = data.meta || {};
      const hashes = data.hashes || {};
      const ph = data.perceptual || {};
      const exif = data.exif || {};
      const summary = data.exif_summary || {};
      const gps = data.gps;
      const fstats = data.file_stats || {};

      const exifJson = Object.keys(exif).length ? JSON.stringify(exif, null, 2) : "";
      const sumRows = summaryRows(summary);

      const entropyRow =
        fstats.entropy_bits_per_byte != null
          ? kvHtml([
              ["Энтропия (бит/байт)", String(fstats.entropy_bits_per_byte)],
              ["Подсказка", fstats.hint || "—"],
            ])
          : "";

      resultsEl.innerHTML = `
        ${gpsBlock(gps)}
        <div class="tool-results-card tool-google-osint-block success">
          <div class="tool-results-card__header">
            <h3 class="tool-results-card__title">Метаданные файла</h3>
            <span class="tool-results-card__summary">${escapeHtml(meta.mime_detected || meta.format || "")}</span>
          </div>
          <div class="tool-results-card__content">${kvHtml(metaRows(meta))}</div>
        </div>

        ${
          fstats.entropy_bits_per_byte != null
            ? `<div class="tool-results-card tool-google-osint-block success">
          <div class="tool-results-card__header">
            <h3 class="tool-results-card__title">Энтропия</h3>
            <span class="tool-results-card__summary">анализ байтов</span>
          </div>
          <div class="tool-results-card__content">${entropyRow}</div>
        </div>`
            : ""
        }

        ${
          sumRows.length
            ? `<div class="tool-results-card tool-google-osint-block success">
          <div class="tool-results-card__header">
            <h3 class="tool-results-card__title">Ключевые поля EXIF</h3>
            <span class="tool-results-card__summary">сводка</span>
          </div>
          <div class="tool-results-card__content">${kvHtml(sumRows)}</div>
        </div>`
            : ""
        }

        <div class="tool-results-card tool-google-osint-block success">
          <div class="tool-results-card__header">
            <h3 class="tool-results-card__title">Хэши</h3>
            <span class="tool-results-card__summary">md5 / sha / crc + perceptual</span>
          </div>
          <div class="tool-results-card__content">${hashRowsSafe(hashes, ph).join("")}</div>
        </div>

        <div class="tool-results-card tool-google-osint-block ${Object.keys(exif).length ? "success" : "error"}">
          <div class="tool-results-card__header">
            <h3 class="tool-results-card__title">EXIF (Pillow, быстрый)</h3>
            <span class="tool-results-card__summary">${Object.keys(exif).length ? "найден" : "нет"}</span>
          </div>
          <div class="tool-results-card__content">
            ${
              exifJson
                ? `<details><summary class="ps-details-sum">Развернуть JSON</summary><pre class="tool-results-card__pre">${escapeHtml(exifJson)}</pre></details>`
                : `<pre class="tool-results-card__pre">(EXIF не найден или удалён при экспорте)</pre>`
            }
          </div>
        </div>
        ${exiftoolSection(data.exiftool)}
        ${reverseLinksCard()}
      `;

      setStatus("Готово.", false);
    } catch (err) {
      setStatus(err.message || "Ошибка", false);
      resultsEl.innerHTML = `<div class="tool-results-card tool-google-osint-block error"><div class="tool-results-card__content">${escapeHtml(err.message || "Ошибка")}</div></div>`;
    } finally {
      statusEl.classList.remove("is-loading");
      btnAnalyze.disabled = false;
    }
  });
}
