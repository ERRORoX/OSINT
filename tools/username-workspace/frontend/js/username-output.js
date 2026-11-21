/**
 * Вывод вкладок Username: сетка карточек по ссылкам (как в osint-panel), полный CLI — в <details>.
 */
import { escapeHtml, linkify } from "/js/tools/results-cards.js";

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

/** Известные сайты → короткое имя платформы */
const HOST_LABELS = {
  "github.com": "GitHub",
  "gist.github.com": "GitHub Gist",
  "avatars.githubusercontent.com": "GitHub (assets)",
  "raw.githubusercontent.com": "GitHub (raw)",
  "user-images.githubusercontent.com": "GitHub (images)",
  "media.discordapp.net": "Discord (media)",
  "cdn.discordapp.com": "Discord (cdn)",
  "gitlab.com": "GitLab",
  "bitbucket.org": "Bitbucket",
  "twitter.com": "Twitter/X",
  "x.com": "X",
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "vk.com": "ВКонтакте",
  "ok.ru": "Одноклассники",
  "reddit.com": "Reddit",
  "linkedin.com": "LinkedIn",
  "youtube.com": "YouTube",
  "tiktok.com": "TikTok",
  "pinterest.com": "Pinterest",
  "twitch.tv": "Twitch",
  "medium.com": "Medium",
  "dev.to": "DEV",
  "stackoverflow.com": "Stack Overflow",
  "soundcloud.com": "SoundCloud",
  "github.io": "GitHub Pages",
  "t.me": "Telegram",
  "telegram.me": "Telegram",
  "discord.com": "Discord",
  "steamcommunity.com": "Steam",
};

function trimUrl(u) {
  return u.replace(/[.,;:!?)}\]]+$/, "");
}

function categoryForHost(host) {
  const h = host.toLowerCase();
  if (/github|gitlab|bitbucket|stackoverflow|dev\.to|npmjs/.test(h)) return "Разработка";
  if (/twitter|^x\.com|instagram|facebook|vk\.com|reddit|linkedin|tiktok|ok\.ru|t\.me|telegram/.test(h)) return "Соцсети";
  if (/youtube|twitch|tiktok|vimeo/.test(h)) return "Видео";
  if (/forum|discuss\.|community\./.test(h)) return "Форумы";
  if (/shop|store|market/.test(h)) return "Сервис";
  return "Сайт";
}

const MULTI_TLDS = new Set([
  "com.br",
  "com.au",
  "com.ar",
  "com.mx",
  "com.tr",
  "com.ua",
  "co.uk",
  "org.uk",
  "gov.uk",
  "co.jp",
  "co.kr",
  "co.in",
  "co.id",
  "co.za",
  "com.sg",
  "com.hk",
  "com.tw",
  "com.cn",
  "com.ru",
  "com.pl",
  "com.de",
  "net.ru",
  "org.ru",
]);

function baseDomain(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  const p = h.split(".").filter(Boolean);
  if (p.length < 2) return h;
  const last2 = p.slice(-2).join(".");
  const last3 = p.slice(-3).join(".");
  const tld = MULTI_TLDS.has(last2) ? last2 : (MULTI_TLDS.has(last3) ? last3 : last2);
  const tldParts = tld.split(".").length;
  const baseIdx = p.length - tldParts - 1;
  const base = baseIdx >= 0 ? p[baseIdx] : p[p.length - 2];
  const root = baseIdx >= 0 ? `${base}.${tld}` : last2;
  return { base, root };
}

function platformFromHost(host) {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (HOST_LABELS[h]) return HOST_LABELS[h];
  const bd = baseDomain(h);
  if (bd && typeof bd === "object" && bd.base) {
    const base = bd.base;
    return base.slice(0, 1).toUpperCase() + base.slice(1);
  }
  return h || "Ссылка";
}

function isRootDomainUrl(url) {
  try {
    const parsed = new URL(url);
    return !parsed.pathname.replace(/\/+$/, "") && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

function urlActionLabel(url) {
  return isRootDomainUrl(url) ? "Открыть сайт · профиль не найден" : "Открыть найденную страницу";
}

function shortUrlLabel(url) {
  try {
    const u = new URL(url);
    const s = (u.hostname.replace(/^www\./, "") + u.pathname + u.search).replace(/\/$/, "");
    return s.length > 58 ? `${s.slice(0, 56)}…` : s;
  } catch {
    return url.length > 60 ? `${url.slice(0, 58)}…` : url;
  }
}

function pluralLinks(n) {
  const k = n % 100;
  if (k >= 11 && k <= 14) return `${n} уникальных ссылок`;
  const m = n % 10;
  if (m === 1) return `${n} уникальная ссылка`;
  if (m >= 2 && m <= 4) return `${n} уникальные ссылки`;
  return `${n} уникальных ссылок`;
}

/**
 * Уникальные HTTP(S) ссылки из текста с метаданными для карточек.
 */
export function parseUrlEntries(text) {
  const raw = (text || "").match(URL_RE) || [];
  const seen = new Set();
  const entries = [];
  for (let u of raw) {
    u = trimUrl(u);
    if (!/^https?:\/\//i.test(u)) continue;
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let host = "";
    try {
      host = new URL(u).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (!host) continue;
    const root = baseDomain(host);
    const rootDomain = (root && typeof root === "object" && root.root) ? root.root : host;
    entries.push({
      url: u,
      host,
      rootDomain,
      platform: platformFromHost(host),
      category: categoryForHost(host),
    });
  }
  entries.sort((a, b) => a.host.localeCompare(b.host, "ru"));
  return entries;
}

function parseTreeKeyValue(line) {
  // Examples: "├─uid: 97256952", "└─bio: Student ..."
  const m = String(line || "").match(/^[\s│]*[├└]─\s*([^:]+):\s*(.*)$/);
  if (!m) return null;
  return { key: (m[1] || "").trim(), value: (m[2] || "").trim() };
}

/**
 * Парсер «Maigret-like» блоков:
 * [+] GitHub: https://github.com/user
 *   ├─uid: ...
 *   └─image: https://...
 */
export function parseMaigretBlocks(text) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks = [];
  let cur = null;

  const push = () => {
    if (cur && cur.url) blocks.push(cur);
    cur = null;
  };

  for (const ln0 of lines) {
    const ln = ln0.trimEnd();
    const head = ln.match(/^\[\+\]\s+(.+?):\s*(https?:\/\/\S+)/);
    if (head) {
      push();
      cur = { platformRaw: head[1].trim(), url: trimUrl(head[2].trim()), fields: {} };
      continue;
    }
    const kv = parseTreeKeyValue(ln);
    if (kv && cur) {
      cur.fields[kv.key] = kv.value;
      continue;
    }
  }
  push();

  // Post-process: derive host/category/platform
  return blocks
    .map((b) => {
      let host = "";
      try {
        host = new URL(b.url).hostname.replace(/^www\./, "");
      } catch {
        host = "";
      }
      const root = host ? baseDomain(host) : null;
      const rootDomain = root && typeof root === "object" && root.root ? root.root : host;
      const platform = host ? platformFromHost(host) : (b.platformRaw || "Профиль");
      const category = host ? categoryForHost(host) : "Сайт";
      const image = b.fields.image && /^https?:\/\//i.test(b.fields.image) ? b.fields.image : "";
      return { ...b, host, rootDomain, platform, category, image };
    })
    .filter((b) => b.url);
}

export function parseSherlockLines(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  for (const ln0 of lines) {
    const ln = ln0.trim();
    // Common sherlock output: "[+] Site: https://..." or "[-] Site: Not Found!"
    let m = ln.match(/^\[\+\]\s*([^:]+):\s*(https?:\/\/\S+)/);
    if (m) {
      out.push({ platformRaw: m[1].trim(), url: trimUrl(m[2].trim()), found: true });
      continue;
    }
    m = ln.match(/^\[\-\]\s*([^:]+):\s*(https?:\/\/\S+)?/);
    if (m) {
      out.push({ platformRaw: m[1].trim(), url: m[2] ? trimUrl(m[2].trim()) : "", found: false });
      continue;
    }
  }
  return out
    .map((b) => {
      let host = "";
      if (b.url) {
        try {
          host = new URL(b.url).hostname.replace(/^www\./, "");
        } catch {
          host = "";
        }
      }
      const platform = host ? platformFromHost(host) : (b.platformRaw || "Платформа");
      const category = host ? categoryForHost(host) : "Сайт";
      return { ...b, host, platform, category };
    })
    .filter((b) => b.platformRaw);
}

function renderFieldsTable(fields) {
  const entries = Object.entries(fields || {}).filter(([k, v]) => String(v || "").trim().length > 0);
  if (!entries.length) return "";
  const safe = entries
    .slice(0, 10)
    .map(([k, v]) => {
      const vv = String(v);
      const valHtml = /^https?:\/\//i.test(vv) ? `<a href="${escapeHtml(vv)}" target="_blank" rel="noopener">${escapeHtml(shortUrlLabel(vv))}</a>` : escapeHtml(vv);
      return `<div class="u-field"><span class="u-key">${escapeHtml(k)}</span><span class="u-val">${valHtml}</span></div>`;
    })
    .join("");
  return `<div class="u-fields">${safe}</div>`;
}

function renderVerifyBadge() {
  return `<span class="u-verify" data-verify-badge>—</span>`;
}

function analyzeOutput(raw) {
  const t = String(raw || "");
  const low = t.toLowerCase();
  const flags = [];
  if (!t.trim()) flags.push({ type: "warn", title: "Пустой вывод", text: "Инструмент не вернул текст." });
  if (t.includes("Traceback (most recent call last):") || /ModuleNotFoundError|ImportError|SyntaxError/.test(t)) {
    flags.push({ type: "err", title: "Ошибка Python", text: "В выводе обнаружен traceback/ошибка импорта." });
  }
  if (/timeout|timed out|превышено время ожидания|read timed out/.test(low)) {
    flags.push({ type: "warn", title: "Таймаут", text: "Похоже, инструмент упёрся в таймаут. Попробуйте повторить или снизить нагрузку." });
  }
  if (/429|too many requests|rate limit|blocked|captcha/.test(low)) {
    flags.push({ type: "warn", title: "Rate limit / блокировка", text: "Есть признаки ограничения запросов (429/rate-limit/captcha)." });
  }
  if (/not found|не найден|command not found|команда не найдена/.test(low)) {
    flags.push({ type: "err", title: "Инструмент не найден", text: "Похоже, не установлена зависимость/CLI или неверный путь." });
  }
  return flags;
}

function topDomains(entries, max = 6) {
  const m = new Map();
  for (const e of entries || []) {
    const d = e.rootDomain || e.host || "";
    if (!d) continue;
    m.set(d, (m.get(d) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
}

const COUNTER_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

const TAB_COUNTER_STYLE = {
  sherlock: "color: var(--green);",
  maigret: "color: var(--purple);",
  social: "color: var(--green);",
  blackbird: "color: var(--red);",
};

function wireCopy(container, cardId, rawText) {
  const btn = container.querySelector(`[data-copy-for="${cardId}"]`);
  if (!btn) return;
  btn.addEventListener("click", () => {
    navigator.clipboard.writeText(rawText).then(
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
}

/**
 * Рендер содержимого вкладки: сетка карточек + сворачиваемый полный вывод.
 */
export function renderUsernameTabPane(container, { tabId, output, success }) {
  if (!container) return;
  const raw = (output || "").trim();
  const entries = parseUrlEntries(raw);
  const cardId = "username-raw-" + Math.random().toString(36).slice(2, 10);
  const counterStyle = TAB_COUNTER_STYLE[tabId] || "color: var(--green);";
  const flags = analyzeOutput(raw);

  // Enhanced Maigret: show fields
  if (tabId === "maigret") {
    const blocks = parseMaigretBlocks(raw);
    if (blocks.length) {
      const tops = topDomains(blocks, 6);
      const topsHtml = tops.length
        ? `<div class="username-top-domains"><span class="username-top-label">Топ доменов:</span>${tops
            .map(([d, n]) => `<span class="username-top-pill">${escapeHtml(d)} <strong>${n}</strong></span>`)
            .join("")}</div>`
        : "";
      const flagsHtml = flags.length
        ? `<div class="username-flags">${flags
            .map(
              (f) =>
                `<div class="username-flag ${f.type === "err" ? "is-err" : "is-warn"}"><strong>${escapeHtml(
                  f.title
                )}</strong><span>${escapeHtml(f.text)}</span></div>`
            )
            .join("")}</div>`
        : "";

      const grid = blocks
        .map((b) => {
          const title = b.platform || b.platformRaw || "Профиль";
          const sub = `${b.category} · ${b.host || b.rootDomain || ""}`.trim();
          const avatar = b.image ? `<img class="u-avatar" src="${escapeHtml(b.image)}" alt="">` : `<div class="u-avatar u-avatar--empty"></div>`;
          const fieldsHtml = renderFieldsTable(b.fields);
          return `
            <div class="result-card found card-appear u-rich-card" data-verify-url="${escapeHtml(b.url)}">
              <div class="result-card-top">
                <div class="result-card-left">
                  ${avatar}
                  <div class="u-rich-head">
                    <span class="result-platform">${escapeHtml(title)}</span>
                    <span class="u-sub">${escapeHtml(sub)}</span>
                  </div>
                </div>
              </div>
              <a href="${escapeHtml(b.url)}" class="result-url" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(urlActionLabel(b.url))}">${escapeHtml(shortUrlLabel(b.url))} ↗</a><span class="u-url-kind">${escapeHtml(urlActionLabel(b.url))}</span>
              <div class="u-meta-row">
                ${renderVerifyBadge()}
              </div>
              ${fieldsHtml}
            </div>`;
        })
        .join("");

      container.innerHTML = `
        <div class="username-tab-output">
          ${flagsHtml}
          <div class="result-counter" style="${counterStyle}">
            ${COUNTER_ICON}
            <span>${pluralLinks(blocks.length)} в отчёте Maigret</span>
            <button type="button" class="u-verify-btn" data-verify-scope="tab">Проверить найденные</button>
          </div>
          ${topsHtml}
          <div class="results-grid">
            ${grid}
          </div>
          <details class="username-raw-details">
            <summary class="username-raw-summary">Полный вывод инструмента (CLI)</summary>
            <div class="username-raw-wrap">
              <div class="tool-results-card tool-google-osint-block ${success ? "success" : "error"}">
                <div class="tool-results-card__header">
                  <span class="tool-results-card__summary">Исходный текст</span>
                  <button type="button" class="btn btn-results-copy" title="Копировать вывод" data-copy-for="${cardId}">Копировать</button>
                </div>
                <div class="tool-results-card__content">
                  <pre class="tool-results-card__pre" id="${cardId}">${linkify(raw)}</pre>
                </div>
              </div>
            </div>
          </details>
        </div>`;

      wireCopy(container, cardId, raw);
      return;
    }
  }

  // Enhanced Sherlock: FOUND / NOT FOUND cards
  if (tabId === "sherlock") {
    const rows = parseSherlockLines(raw);
    if (rows.length) {
      const found = rows.filter((r) => r.found).length;
      const total = rows.length;
      const rowsFound = rows.filter((r) => r.found && r.url);
      const flagsHtml = flags.length
        ? `<div class="username-flags">${flags
            .map(
              (f) =>
                `<div class="username-flag ${f.type === "err" ? "is-err" : "is-warn"}"><strong>${escapeHtml(
                  f.title
                )}</strong><span>${escapeHtml(f.text)}</span></div>`
            )
            .join("")}</div>`
        : "";

      const cards = rowsFound
        .slice(0, 400)
        .map((r) => {
          const cls = "found";
          const dotCls = "found status-dot-green";
          const urlLine = `<a href="${escapeHtml(r.url)}" class="result-url" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(urlActionLabel(r.url))}">${escapeHtml(
            shortUrlLabel(r.url)
          )} ↗</a><span class="u-url-kind">${escapeHtml(urlActionLabel(r.url))}</span>`;
          const verify = ` data-verify-url="${escapeHtml(r.url)}"`;
          return `
            <div class="result-card ${cls} card-appear"${verify}>
              <div class="result-card-top">
                <div class="result-card-left">
                  <div class="result-dot ${dotCls}"></div>
                  <span class="result-platform">${escapeHtml(r.platform || r.platformRaw)}</span>
                </div>
              </div>
              ${urlLine}
              <div class="u-meta-row">${renderVerifyBadge()}</div>
              <div class="result-category">${escapeHtml(r.category)}${r.host ? ` · ${escapeHtml(r.host)}` : ""}</div>
            </div>`;
        })
        .join("");

      container.innerHTML = `
        <div class="username-tab-output">
          ${flagsHtml}
          <div class="result-counter" style="${counterStyle}">
            ${COUNTER_ICON}
            <span>Показаны только FOUND: ${found} из ${total} платформ (по выводу Sherlock)</span>
            <button type="button" class="u-verify-btn" data-verify-scope="tab">Проверить найденные</button>
          </div>
          <div class="results-grid">${cards}</div>
          <details class="username-raw-details">
            <summary class="username-raw-summary">Полный вывод инструмента (CLI)</summary>
            <div class="username-raw-wrap">
              <div class="tool-results-card tool-google-osint-block ${success ? "success" : "error"}">
                <div class="tool-results-card__header">
                  <span class="tool-results-card__summary">Исходный текст</span>
                  <button type="button" class="btn btn-results-copy" title="Копировать вывод" data-copy-for="${cardId}">Копировать</button>
                </div>
                <div class="tool-results-card__content">
                  <pre class="tool-results-card__pre" id="${cardId}">${linkify(raw)}</pre>
                </div>
              </div>
            </div>
          </details>
        </div>`;
      wireCopy(container, cardId, raw);
      return;
    }
  }

  if (entries.length === 0) {
    const statusClass = success ? "success" : "error";
    const msg = raw || "(нет вывода)";
    const flagsHtml = flags.length
      ? `<div class="username-flags">${flags
          .map(
            (f) =>
              `<div class="username-flag ${f.type === "err" ? "is-err" : "is-warn"}"><strong>${escapeHtml(
                f.title
              )}</strong><span>${escapeHtml(f.text)}</span></div>`
          )
          .join("")}</div>`
      : "";
    container.innerHTML = `
      <div class="username-tab-output">
        ${flagsHtml}
        <div class="tool-results-card tool-google-osint-block osint-card-hover ${statusClass}">
          <div class="tool-results-card__header">
            <h3 class="tool-results-card__title">Текст ответа</h3>
            <span class="tool-results-card__summary">${success ? "HTTP(S)-ссылок в тексте не обнаружено" : "Ошибка или пустой вывод"}</span>
            <button type="button" class="btn btn-results-copy" title="Копировать вывод" data-copy-for="${cardId}">Копировать</button>
          </div>
          <div class="tool-results-card__content">
            <pre class="tool-results-card__pre" id="${cardId}">${linkify(msg)}</pre>
          </div>
        </div>
      </div>`;
    wireCopy(container, cardId, msg);
    return;
  }

  const tops = topDomains(entries, 6);
  const topsHtml = tops.length
    ? `<div class="username-top-domains"><span class="username-top-label">Топ доменов:</span>${tops
        .map(([d, n]) => `<span class="username-top-pill">${escapeHtml(d)} <strong>${n}</strong></span>`)
        .join("")}</div>`
    : "";
  const flagsHtml = flags.length
    ? `<div class="username-flags">${flags
        .map(
          (f) =>
            `<div class="username-flag ${f.type === "err" ? "is-err" : "is-warn"}"><strong>${escapeHtml(
              f.title
            )}</strong><span>${escapeHtml(f.text)}</span></div>`
        )
        .join("")}</div>`
    : "";

  const gridHtml = entries
    .map(
      (e) => `
    <div class="result-card found card-appear" data-verify-url="${escapeHtml(e.url)}">
      <div class="result-card-top">
        <div class="result-card-left">
          <div class="result-dot found status-dot-green"></div>
          <span class="result-platform">${escapeHtml(e.platform)}</span>
        </div>
      </div>
      <a href="${escapeHtml(e.url)}" class="result-url" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(urlActionLabel(e.url))}">${escapeHtml(shortUrlLabel(e.url))} ↗</a><span class="u-url-kind">${escapeHtml(urlActionLabel(e.url))}</span>
      <div class="u-meta-row">${renderVerifyBadge()}</div>
      <div class="result-category">${escapeHtml(e.category)} · ${escapeHtml(e.host)}</div>
    </div>`
    )
    .join("");

  container.innerHTML = `
    <div class="username-tab-output">
      ${flagsHtml}
      <div class="result-counter" style="${counterStyle}">
        ${COUNTER_ICON}
        <span>${pluralLinks(entries.length)} в тексте ответа</span>
        <button type="button" class="u-verify-btn" data-verify-scope="tab">Проверить найденные</button>
      </div>
      ${topsHtml}
      <div class="results-grid">
        ${gridHtml}
      </div>
      <details class="username-raw-details">
        <summary class="username-raw-summary">Полный вывод инструмента (CLI)</summary>
        <div class="username-raw-wrap">
          <div class="tool-results-card tool-google-osint-block ${success ? "success" : "error"}">
            <div class="tool-results-card__header">
              <span class="tool-results-card__summary">Исходный текст</span>
              <button type="button" class="btn btn-results-copy" title="Копировать вывод" data-copy-for="${cardId}">Копировать</button>
            </div>
            <div class="tool-results-card__content">
              <pre class="tool-results-card__pre" id="${cardId}">${linkify(raw)}</pre>
            </div>
          </div>
        </div>
      </details>
    </div>`;

  wireCopy(container, cardId, raw);
}
