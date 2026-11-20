const API = "/api";

const TOOLS = [
  { id: "domain-search", name: "Информация о домене", desc: "WHOIS, DNS, SSL, crt.sh", cat: "Основное", color: "var(--sky)", sources: ["WHOIS", "DNS", "SSL", "crt.sh"] },
  { id: "theharvester", name: "theHarvester", desc: "Emails, поддомены, хосты", cat: "Сбор данных", color: "var(--amber)", sources: ["DuckDuckGo", "Brave", "Crt.sh", "RapidDNS", "HackerTarget", "ThreatCrowd", "VirusTotal", "Shodan", "Hunter", "Google", "Bing"] },
  { id: "shodan", name: "Shodan", desc: "Поиск хостов по домену (API)", cat: "Сканирование", color: "var(--red)", sources: ["Shodan API", "InternetDB"] },
  { id: "subfinder", name: "Subfinder", desc: "Пассивный поиск поддоменов", cat: "Обнаружение", color: "var(--violet)", sources: ["CT Logs", "Passive DNS"] },
  { id: "dnsx", name: "dnsx", desc: "DNS A/AAAA/CNAME", cat: "DNS", color: "var(--emerald)", sources: ["A", "AAAA", "CNAME", "MX", "NS", "TXT"] },
];

const SOURCE_OPTIONS = [
  { id: "duckduckgo", label: "DuckDuckGo" },
  { id: "brave", label: "Brave Search" },
  { id: "crtsh", label: "Crt.sh" },
  { id: "rapiddns", label: "RapidDNS" },
  { id: "hackertarget", label: "HackerTarget" },
  { id: "threatcrowd", label: "ThreatCrowd" },
  { id: "virustotal", label: "VirusTotal (API)" },
  { id: "shodan", label: "Shodan (API)" },
  { id: "hunter", label: "Hunter (API)" },
  { id: "google", label: "Google" },
  { id: "bing", label: "Bing" },
];

const CATEGORIES = [...new Set(TOOLS.map((t) => t.cat))];
const CAT_ICONS = {
  "Основное":
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  "Сбор данных":
    '<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  "Сканирование":
    '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
  "Обнаружение": '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  DNS: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
};

const TOOL_SVG = {
  "domain-search":
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  theharvester:
    '<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  shodan:
    '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
  subfinder: '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  dnsx: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
};

const IC = {
  check:
    '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xcirc:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  loader:
    '<svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
  chevUp: '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>',
  retry:
    '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  play: '<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  net: '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  db: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
};

const TOOL_SOURCES_UI = {
  theharvester: { sources: ["duckduckgo"], limit: 100 },
};

/* ── State ── */
let domain = "";
let submitted = false;
let running = new Set();
let doneSet = new Set();
let errSet = new Set();
let collapsedSet = new Set();
let results = {};
let selectedTools = new Set(TOOLS.map((t) => t.id));
let filterText = "";
let lastReport = null;

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ""));
  } catch (_) {
    try {
      const ta = document.createElement("textarea");
      ta.value = String(text || "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {
      alert("Не удалось скопировать.");
    }
  }
}

function downloadTextFile(filename, mime, content) {
  const blob = new Blob([String(content || "")], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch (_) {
    return String(Date.now());
  }
}

function buildReportData() {
  const tools = TOOLS.filter((t) => selectedTools.has(t.id)).map((t) => {
    const r = results[t.id] || {};
    return {
      id: t.id,
      name: t.name,
      category: t.cat,
      success: !!r.success,
      output: String(r.output || ""),
      stats: r.stats || null,
    };
  });
  const indicatorsByTool = tools.map((t) => extractIndicators(domain, t.output));
  const all = { subs: new Set(), ips: new Set(), emails: new Set(), urls: new Set() };
  indicatorsByTool.forEach((x) => {
    x.subs.forEach((v) => all.subs.add(v));
    x.ips.forEach((v) => all.ips.add(v));
    x.emails.forEach((v) => all.emails.add(v));
    x.urls.forEach((v) => all.urls.add(v));
  });
  return {
    version: 1,
    created_at: nowIso(),
    domain,
    wall_seconds: lastWallSeconds || 0,
    selected_tools: [...selectedTools],
    theharvester: { ...TOOL_SOURCES_UI.theharvester },
    indicators: {
      subdomains: [...all.subs].sort(),
      ips: [...all.ips].sort(),
      emails: [...all.emails].sort(),
      urls: [...all.urls].sort(),
    },
    tools,
  };
}

function reportToMarkdown(rep) {
  const dmn = rep?.domain || "";
  const ind = rep?.indicators || {};
  const lines = [];
  lines.push(`# OSINT Domain Report`);
  lines.push("");
  lines.push(`- **Domain**: \`${dmn}\``);
  lines.push(`- **Created**: \`${rep?.created_at || ""}\``);
  lines.push(`- **Wall time**: \`${(rep?.wall_seconds || 0).toFixed(2)}s\``);
  lines.push("");
  lines.push(`## Indicators`);
  lines.push("");
  const pushList = (title, arr) => {
    lines.push(`### ${title} (${arr.length})`);
    lines.push("");
    if (!arr.length) {
      lines.push(`- (none)`);
    } else {
      arr.slice(0, 500).forEach((x) => lines.push(`- \`${x}\``));
      if (arr.length > 500) lines.push(`- ... +${arr.length - 500} more`);
    }
    lines.push("");
  };
  pushList("Subdomains", ind.subdomains || []);
  pushList("IPs", ind.ips || []);
  pushList("Emails", ind.emails || []);
  pushList("URLs", ind.urls || []);
  lines.push(`## Tools output`);
  lines.push("");
  (rep?.tools || []).forEach((t) => {
    lines.push(`### ${t.name} (${t.id})`);
    lines.push("");
    lines.push(`- **Success**: \`${t.success ? "yes" : "no"}\``);
    lines.push("");
    lines.push("```");
    lines.push(String(t.output || "").slice(0, 150_000));
    lines.push("```");
    lines.push("");
  });
  return lines.join("\n");
}

function reportToText(rep) {
  const dmn = rep?.domain || "";
  const ind = rep?.indicators || {};
  const lines = [];
  lines.push(`OSINT Domain Report`);
  lines.push(`Domain: ${dmn}`);
  lines.push(`Created: ${rep?.created_at || ""}`);
  lines.push(`Wall time: ${(rep?.wall_seconds || 0).toFixed(2)}s`);
  lines.push("");
  const pushBlock = (title, arr) => {
    lines.push(`${title} (${arr.length})`);
    lines.push("-".repeat(Math.min(40, title.length + 10)));
    (arr || []).slice(0, 1000).forEach((x) => lines.push(String(x)));
    if ((arr || []).length > 1000) lines.push(`... +${arr.length - 1000} more`);
    lines.push("");
  };
  pushBlock("Subdomains", ind.subdomains || []);
  pushBlock("IPs", ind.ips || []);
  pushBlock("Emails", ind.emails || []);
  pushBlock("URLs", ind.urls || []);
  (rep?.tools || []).forEach((t) => {
    lines.push(`========== ${t.name} (${t.id}) ==========`); 
    lines.push(String(t.output || ""));
    lines.push("");
  });
  return lines.join("\n");
}

const HISTORY_KEY = "osint_domain_history_v1";
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}
function saveHistoryItem(rep) {
  try {
    const item = {
      id: String(Date.now()),
      created_at: rep.created_at,
      domain: rep.domain,
      wall_seconds: rep.wall_seconds,
      indicators: rep.indicators,
      selected_tools: rep.selected_tools,
      tools: rep.tools,
    };
    const prev = loadHistory();
    const next = [item, ...prev.filter((x) => x.domain !== item.domain)].slice(0, 10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (_) {}
}

function applyReport(rep) {
  if (!rep || typeof rep !== "object") return;
  domain = normalizeDomain(rep.domain || "");
  submitted = true;
  running = new Set();
  doneSet = new Set((rep.tools || []).map((t) => t.id));
  errSet = new Set((rep.tools || []).filter((t) => !t.success).map((t) => t.id));
  collapsedSet = new Set();
  results = {};
  selectedTools = new Set(rep.selected_tools || TOOLS.map((t) => t.id));
  TOOL_SOURCES_UI.theharvester = rep.theharvester || TOOL_SOURCES_UI.theharvester;
  lastWallSeconds = rep.wall_seconds || 0;
  (rep.tools || []).forEach((t) => {
    results[t.id] = { success: !!t.success, output: String(t.output || ""), stats: t.stats || null };
  });
  lastReport = rep;
  render();
}

function normalizeDomain(s) {
  if (!s || typeof s !== "string") return "";
  let t = s.trim().toLowerCase();
  if (t.startsWith("https://")) t = t.slice(8);
  else if (t.startsWith("http://")) t = t.slice(7);
  const slash = t.indexOf("/");
  if (slash !== -1) t = t.slice(0, slash);
  if (t.startsWith("www.")) t = t.slice(4);
  return t;
}

async function apiRun(toolId, params) {
  const res = await fetch(`${API}/tools/${toolId}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.message || res.statusText || "Ошибка запроса";
    throw new Error(msg);
  }
  return data;
}

/** Парсинг вывода dnsx (типичный формат projectdiscovery: host [TYPE] value) */
function parseDnsxOutput(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || /^error|traceback/i.test(t)) continue;
    const m1 = t.match(/^([a-z0-9._*][a-z0-9._*-]*)\s+\[([A-Z0-9]+)\]\s+(.+)$/i);
    if (m1) {
      rows.push({ host: m1[1].replace(/^\*\./, ""), type: m1[2], value: m1[3].trim() });
      continue;
    }
    const m2 = t.match(/^([a-z0-9._*][a-z0-9._*-]+)\s+(\d{1,3}(?:\.\d{1,3}){3})\s*$/);
    if (m2) {
      rows.push({ host: m2[1], type: "A", value: m2[2] });
      continue;
    }
    const m3 = t.match(/^([a-z0-9._*][a-z0-9._*-]+)[\t]+(\d{1,3}(?:\.\d{1,3}){3})\s*$/);
    if (m3) {
      rows.push({ host: m3[1], type: "A", value: m3[2] });
    }
  }
  return rows;
}

/** Поддомены subfinder: по одному имени на строку */
function parseSubfinderOutput(text) {
  const re = /^[a-z0-9*][a-z0-9.*-]*\.[a-z0-9.-]+$/i;
  const out = [];
  const seen = new Set();
  for (const line of String(text || "").split("\n")) {
    const s = line.trim().toLowerCase();
    if (!s || s.startsWith("[") || s.includes("subfinder") || s.includes("error")) continue;
    if (re.test(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** Разбор текста «Поиск по домену» (modules/domain_search) */
function parseDomainSearchOutput(text) {
  const t = String(text || "");
  let ip = null;
  const ipLine = t.match(/IP адрес:\s*(.+)$/im);
  if (ipLine) {
    const v = ipLine[1].trim();
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(v) || /^[0-9a-f:]+$/i.test(v)) ip = v;
  }
  const dnsRows = [];
  const whoisRows = [];
  let inWhois = false;
  let inDns = false;
  for (const line of t.split("\n")) {
    if (line.includes("=== WHOIS ===")) {
      inWhois = true;
      inDns = false;
      continue;
    }
    if (line.includes("=== DNS записи ===")) {
      inDns = true;
      inWhois = false;
      continue;
    }
    if (inWhois && line.includes("Полный текст WHOIS")) {
      inWhois = false;
      continue;
    }
    if (line.trim().startsWith("===")) {
      inWhois = false;
      inDns = false;
      continue;
    }
    if (inDns) {
      const m = line.match(/^\s{2}(A|AAAA|NS|MX|TXT):\s*(.+)$/i);
      if (m) dnsRows.push({ type: m[1].toUpperCase(), value: m[2].trim() });
    }
    if (inWhois) {
      const m = line.match(/^\s{2}([^:]+):\s*(.+)$/);
      if (m && whoisRows.length < 20) whoisRows.push({ key: m[1].trim(), value: m[2].trim() });
    }
  }
  return { ip, dnsRows, whoisRows };
}

function groupUrlsByHost(urls) {
  const map = new Map();
  for (const u of urls) {
    try {
      const url = new URL(u);
      const host = (url.hostname || "").toLowerCase();
      if (!host) continue;
      if (!map.has(host)) map.set(host, { host, urls: [], count: 0 });
      const g = map.get(host);
      g.count += 1;
      if (g.urls.length < 5) g.urls.push(u);
    } catch (_) {}
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function renderDataTable(columns, rows, className) {
  if (!rows || !rows.length) return "";
  const cn = className ? ` ${className}` : "";
  return `<div class="dt-table-wrap${cn}"><table class="dt-table"><thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((cell) => `<td>${esc(String(cell ?? "—"))}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function renderNextStepsBlock(rep) {
  const dmn = rep?.domain || domain;
  const ind = rep?.indicators || { subdomains: [], ips: [], urls: [] };
  const subs = ind.subdomains || [];
  const ips = ind.ips || [];
  const urls = ind.urls || [];
  const grouped = groupUrlsByHost(urls);
  const subPreview = subs.slice(0, 8);
  const ipPreview = ips.slice(0, 6);

  const urlTableRows = grouped.slice(0, 30).map((g) => [g.host, String(g.count), g.urls[0] || "—"]);

  return `
    <div class="dt-next">
      <div class="dt-next__head">
        <div class="dt-next__title">Следующие шаги</div>
        <div class="dt-next__hint">Внешние сервисы открываются в новой вкладке. Используйте только в рамках закона и правил сервисов.</div>
      </div>
      <div class="dt-next__grid">
        <div class="dt-next__card">
          <div class="dt-next__label">Домен</div>
          <div class="dt-next__links">
            <a class="dt-next__a" href="https://www.virustotal.com/gui/domain/${esc(dmn)}" target="_blank" rel="noopener">VirusTotal</a>
            <a class="dt-next__a" href="https://crt.sh/?q=${encodeURIComponent(dmn)}" target="_blank" rel="noopener">crt.sh</a>
            <a class="dt-next__a" href="https://www.shodan.io/search?query=hostname:${encodeURIComponent(dmn)}" target="_blank" rel="noopener">Shodan (hostname)</a>
            <a class="dt-next__a" href="https://securitytrails.com/domain/${esc(dmn)}" target="_blank" rel="noopener">SecurityTrails</a>
          </div>
        </div>
        <div class="dt-next__card">
          <div class="dt-next__label">Поддомены → HTTPS (первые ${subPreview.length})</div>
          <div class="dt-next__btns">
            ${subPreview
              .map(
                (s) =>
                  `<button type="button" class="dt-next__btn" data-dt-open-https="${esc(s)}">https://${esc(s)}</button>`
              )
              .join("")}
            ${subs.length === 0 ? `<span class="dt-next__empty">Нет поддоменов в сводке</span>` : ""}
          </div>
        </div>
        <div class="dt-next__card">
          <div class="dt-next__label">IP → ASN / гео / Shodan</div>
          <div class="dt-next__btns">
            ${ipPreview
              .map(
                (ip) =>
                  `<span class="dt-next__iprow">
                    <code>${esc(ip)}</code>
                    <a class="dt-next__a" href="https://ipinfo.io/${esc(ip)}" target="_blank" rel="noopener">ipinfo</a>
                    <a class="dt-next__a" href="https://bgp.he.net/ip/${esc(ip)}" target="_blank" rel="noopener">HE</a>
                    <a class="dt-next__a" href="https://www.shodan.io/host/${esc(ip)}" target="_blank" rel="noopener">Shodan</a>
                  </span>`
              )
              .join("")}
            ${ips.length === 0 ? `<span class="dt-next__empty">Нет IP в сводке</span>` : ""}
          </div>
        </div>
      </div>
      ${
        grouped.length
          ? `<div class="dt-next__section"><div class="dt-next__label">URL по хостам (топ ${urlTableRows.length})</div>${renderDataTable(["Хост", "Штук", "Пример"], urlTableRows, "dt-table--urls")}</div>`
          : ""
      }
    </div>
  `;
}

function wireNextSteps(root) {
  root.querySelectorAll("[data-dt-open-https]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const host = btn.getAttribute("data-dt-open-https") || "";
      if (!host) return;
      window.open(`https://${host}`, "_blank", "noopener,noreferrer");
    });
  });
}

function extractIndicators(domain_, text) {
  const out = String(text || "");
  const low = out.toLowerCase();
  const urls = new Set((out.match(/https?:\/\/[^\s<>"']+/gi) || []).map((u) => u.replace(/[),.;]+$/, "")));
  const emails = new Set((out.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map((e) => e.toLowerCase()));
  const ips = new Set(out.match(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g) || []);
  const subs = new Set();
  if (domain_) {
    const re = new RegExp(`\\b([a-z0-9-]+\\.)+${domain_.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
    for (const m of out.match(re) || []) subs.add(m.toLowerCase());
  }
  const flags = [];
  if (out.includes("Traceback (most recent call last):") || /ModuleNotFoundError|ImportError|SyntaxError/.test(out)) flags.push("traceback");
  if (/timeout|timed out|превышено время ожидания|read timed out/.test(low)) flags.push("timeout");
  if (/429|too many requests|rate limit|blocked|captcha/.test(low)) flags.push("ratelimit");
  return { urls, emails, ips, subs, flags };
}

function renderDomainSummary({ domain: dmn, indicatorsByTool, wallSeconds }) {
  const allUrls = new Set();
  const allEmails = new Set();
  const allIps = new Set();
  const allSubs = new Set();
  const flags = new Set();
  for (const x of indicatorsByTool) {
    x.urls.forEach((u) => allUrls.add(u));
    x.emails.forEach((e) => allEmails.add(e));
    x.ips.forEach((i) => allIps.add(i));
    x.subs.forEach((s) => allSubs.add(s));
    x.flags.forEach((f) => flags.add(f));
  }
  const flagText =
    flags.size === 0
      ? ""
      : ` · предупреждения: ${[...flags]
          .map((f) => ({ traceback: "traceback", timeout: "timeout", ratelimit: "rate-limit" }[f] || f))
          .join(", ")}`;
  const t = typeof wallSeconds === "number" ? wallSeconds : 0;
  const ts = t ? (t >= 10 ? t.toFixed(1) : t.toFixed(2)) : "—";
  return `
    <div class="dt-summary">
      <div class="dt-summary__row">
        <span class="dt-pill"><strong>Домен</strong> ${esc(dmn)}</span>
        <span class="dt-pill"><strong>Поддомены</strong> ${allSubs.size}</span>
        <span class="dt-pill"><strong>IP</strong> ${allIps.size}</span>
        <span class="dt-pill"><strong>Email</strong> ${allEmails.size}</span>
        <span class="dt-pill"><strong>URL</strong> ${allUrls.size}</span>
        <span class="dt-pill"><strong>Время</strong> ${esc(ts)} c</span>
      </div>
      <div class="dt-summary__actions">
        <input class="dt-filter" id="dtFilter" placeholder="Поиск по результатам (IP/URL/строки)..." value="${esc(filterText)}">
        <button type="button" class="dt-ind-btn" id="btnCopyIndicators">Скопировать индикаторы</button>
        <button type="button" class="dt-ind-btn" id="btnExportMD">Экспорт MD</button>
        <button type="button" class="dt-ind-btn" id="btnExportJSON">Экспорт JSON</button>
        <button type="button" class="dt-ind-btn" id="btnExportTXT">Экспорт TXT</button>
      </div>
      <div class="dt-summary__hint">Сводка считается из реального вывода инструментов (регексы по URL/email/IP/поддоменам).${esc(flagText)}</div>
    </div>
  `;
}

function renderIndicatorBlock({ title, items, kind }) {
  const q = (filterText || "").trim().toLowerCase();
  const filtered = q ? items.filter((x) => String(x).toLowerCase().includes(q)) : items;
  const list = filtered.slice(0, 60);
  const more = items.length > list.length ? `<div class="dt-ind-more">и ещё ${items.length - list.length}…</div>` : "";
  const copyAll = filtered.length ? `<button type="button" class="dt-ind-btn" data-dt-copy="${esc(filtered.join("\n"))}">Скопировать всё</button>` : "";
  const hint =
    kind === "subs"
      ? "Поддомены из вывода инструментов"
      : kind === "ips"
        ? "IP-адреса из вывода инструментов"
        : kind === "emails"
          ? "Email из вывода инструментов"
          : "URL из вывода инструментов";
  return `
    <div class="dt-ind-card">
      <div class="dt-ind-head">
        <div class="dt-ind-title">${esc(title)} <span class="dt-ind-count">${items.length}</span></div>
        <div class="dt-ind-actions">${copyAll}</div>
      </div>
      <div class="dt-ind-hint">${esc(hint)}</div>
      <div class="dt-ind-list">
        ${
          list.length
            ? list
                .map((v) => {
                  const isUrl = /^https?:\/\//i.test(v);
                  const open = isUrl ? `<a class="dt-ind-open" href="${esc(v)}" target="_blank" rel="noopener">Открыть</a>` : "";
                  const ipTools =
                    kind === "ips"
                      ? `<a class="dt-ind-open" href="https://www.shodan.io/host/${esc(v)}" target="_blank" rel="noopener">Shodan</a>
                         <a class="dt-ind-open" href="https://internetdb.shodan.io/${esc(v)}" target="_blank" rel="noopener">InternetDB</a>`
                      : "";
                  return `<div class="dt-ind-item"><code>${esc(v)}</code><span class="dt-ind-item-actions">
                    <button type="button" class="dt-ind-btn" data-dt-copy="${esc(v)}">Копировать</button>${open}${ipTools}
                  </span></div>`;
                })
                .join("")
            : `<div class="dt-ind-empty">Ничего не найдено.</div>`
        }
        ${more}
      </div>
    </div>
  `;
}

function renderIndicatorsOverview({ domain: dmn, indicatorsByTool }) {
  const allUrls = new Set();
  const allEmails = new Set();
  const allIps = new Set();
  const allSubs = new Set();
  for (const x of indicatorsByTool) {
    x.urls.forEach((u) => allUrls.add(u));
    x.emails.forEach((e) => allEmails.add(e));
    x.ips.forEach((i) => allIps.add(i));
    x.subs.forEach((s) => allSubs.add(s));
  }
  const urls = [...allUrls].sort();
  const emails = [...allEmails].sort();
  const ips = [...allIps].sort();
  const subs = [...allSubs].sort();
  return `
    <div class="dt-indicators">
      ${renderIndicatorBlock({ title: "Поддомены", items: subs, kind: "subs" })}
      ${renderIndicatorBlock({ title: "IP", items: ips, kind: "ips" })}
      ${renderIndicatorBlock({ title: "Email", items: emails, kind: "emails" })}
      ${renderIndicatorBlock({ title: "URL", items: urls, kind: "urls" })}
    </div>
  `;
}

function wireCopyButtons(root) {
  root.querySelectorAll("[data-dt-copy]").forEach((btn) => {
    btn.addEventListener("click", () => copyText(btn.getAttribute("data-dt-copy") || ""));
  });
}

async function runTool(id) {
  running.add(id);
  render();
  try {
    if (!domain.trim()) throw new Error("Пустой домен");
    let data;
    if (id === "theharvester") {
      const cfg = TOOL_SOURCES_UI.theharvester;
      const sources = Array.isArray(cfg.sources) && cfg.sources.length ? cfg.sources : ["duckduckgo"];
      const limit = Math.min(500, Math.max(10, parseInt(cfg.limit, 10) || 100));
      data = await apiRun("theharvester", { domain, sources, limit });
    } else {
      data = await apiRun(id, { domain });
    }
    const out = (data.output || data.error || "").trim();
    results[id] = { success: !!data.success, output: out || "(нет вывода)", stats: data.stats || null };
    running.delete(id);
    doneSet.add(id);
    if (!data.success) errSet.add(id);
  } catch (e) {
    results[id] = { success: false, output: e.message || "Ошибка", stats: null };
    running.delete(id);
    errSet.add(id);
    doneSet.add(id);
  }
  render();
}

function readUiSelection() {
  const dIn = document.getElementById("domainInput");
  if (dIn) domain = normalizeDomain(dIn.value);

  const checks = Array.from(document.querySelectorAll('input[name="dt-tool"]:checked')).map((x) => x.value);
  selectedTools = new Set(checks);

  const sources = Array.from(document.querySelectorAll('input[name="dt-source"]:checked')).map((x) => x.value);
  const limEl = document.getElementById("thLimit");
  const limit = limEl ? parseInt(limEl.value, 10) || 100 : 100;
  TOOL_SOURCES_UI.theharvester.sources = sources.length ? sources : ["duckduckgo"];
  TOOL_SOURCES_UI.theharvester.limit = Math.min(500, Math.max(10, limit));
}

async function runAll() {
  readUiSelection();
  if (!domain.trim()) return;
  if (selectedTools.size === 0) {
    alert("Отметьте хотя бы один инструмент.");
    return;
  }
  results = {};
  running = new Set();
  doneSet = new Set();
  errSet = new Set();
  collapsedSet = new Set();
  submitted = true;
  render();
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const promises = TOOLS.filter((t) => selectedTools.has(t.id)).map((t) => runTool(t.id));
  await Promise.allSettled(promises);
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const secs = (t1 - t0) / 1000;
  // финальный ререндер со временем
  lastWallSeconds = secs;
  lastReport = buildReportData();
  saveHistoryItem(lastReport);
  render();
}

async function rerunTool(id) {
  doneSet.delete(id);
  errSet.delete(id);
  collapsedSet.delete(id);
  delete results[id];
  render();
  await runTool(id);
}

function clearAll() {
  domain = "";
  submitted = false;
  results = {};
  running = new Set();
  doneSet = new Set();
  errSet = new Set();
  collapsedSet = new Set();
  lastWallSeconds = 0;
  render();
}

let lastWallSeconds = 0;

function render() {
  renderHeader();
  renderSearch();
  renderMain();
}

function renderHeader() {
  const br = document.getElementById("badgeRunning");
  const bd = document.getElementById("badgeDone");
  if (!br || !bd) return;
  const totalSel = submitted ? Math.max(1, selectedTools.size) : TOOLS.length;
  if (running.size > 0) {
    br.style.display = "inline-flex";
    br.textContent = running.size + " активны";
  } else br.style.display = "none";
  if (doneSet.size > 0) {
    bd.style.display = "inline-flex";
    bd.textContent = doneSet.size + "/" + totalSel;
  } else bd.style.display = "none";
}

function renderSearch() {
  const el = document.getElementById("searchArea");
  const anyR = running.size > 0;
  const progress = doneSet.size;

  if (!submitted) {
    el.innerHTML = `<div class="search-box">
      <div class="search-icon">${IC.search}</div>
      <p class="search-title">Введите домен для OSINT анализа</p>
      <div class="search-row">
        <input class="search-input" placeholder="example.com" id="domainInput" value="${esc(domain)}" onkeydown="if(event.key==='Enter'){runAll()}"/>
        <button class="btn btn-sky" onclick="runAll()">${IC.search} Запустить</button>
      </div>
      <div class="dt-tool-grid">
        ${TOOLS.map(
          (t) => `<label class="dt-tool-check"><input type="checkbox" name="dt-tool" value="${esc(t.id)}" ${selectedTools.has(t.id) ? "checked" : ""}/> <span class="dt-tool-check__name">${esc(t.name)}</span><span class="dt-tool-check__desc">${esc(t.desc)}</span></label>`
        ).join("")}
      </div>
      <div class="th-extra">
        <div class="th-extra__head">theHarvester — источники</div>
        <div class="th-sources">
          ${SOURCE_OPTIONS.map(
            (s) =>
              `<label class="th-source"><input type="checkbox" name="dt-source" value="${esc(s.id)}" ${
                (TOOL_SOURCES_UI.theharvester.sources || []).includes(s.id) ? "checked" : ""
              }/> ${esc(s.label)}</label>`
          ).join("")}
        </div>
        <label class="th-limit">Лимит <input id="thLimit" type="number" min="10" max="500" value="${esc(TOOL_SOURCES_UI.theharvester.limit)}"></label>
      </div>
      <div class="dt-actions">
        <button class="btn btn-sky" type="button" onclick="runAll()">${IC.play} Запустить выбранные</button>
        <button class="btn" type="button" onclick="document.querySelectorAll('input[name=&quot;dt-tool&quot;]').forEach(x=>x.checked=true);runAll()">${IC.play} Запустить всё</button>
      </div>
      <p class="search-sub">Запуск выбранных инструментов параллельно. Для Shodan/theHarvester часть источников требует API ключи (в “API ключи”).</p>
    </div>`;
  } else {
    el.innerHTML = `<div class="preview">
      <span class="preview-domain">${esc(domain)}</span>
      <span class="preview-status">${anyR ? running.size + " выполняется..." : doneSet.size > 0 ? doneSet.size + "/" + TOOLS.length + " завершено" : "Запуск..."}</span>
      <div class="preview-actions">
        <button class="btn btn-sky" onclick="runAll()" ${anyR ? "disabled" : ""}>${anyR ? '<span class="spinner">' + IC.loader + "</span>" : IC.play} ${anyR ? "Анализ..." : "Запустить"}</button>
        <button class="btn" onclick="clearAll()">Сброс</button>
      </div>
    </div>
    ${
      anyR
        ? `<div class="progress-wrap"><div class="progress-bar"><div class="progress-fill" style="width:${(progress / TOOLS.length) * 100}%"></div></div><div class="progress-text"><span>${doneSet.size} готово · ${running.size} выполняется</span><span>${Math.round((progress / TOOLS.length) * 100)}%</span></div></div>`
        : ""
    }`;
  }
}

function renderMain() {
  const el = document.getElementById("mainArea");
  if (!submitted) {
    const hist = loadHistory();
    const histHtml = hist.length
      ? `<div class="dt-history">
          <div class="dt-history__head">
            <div class="dt-history__title">История (последние ${hist.length})</div>
            <button type="button" class="dt-ind-btn" id="btnClearHistory">Очистить</button>
          </div>
          <div class="dt-history__list">
            ${hist
              .map(
                (h) => `<button type="button" class="dt-history__item" data-hist-id="${esc(h.id)}">
                  <span class="dt-history__domain">${esc(h.domain)}</span>
                  <span class="dt-history__meta">${esc(String(h.created_at || "").replace("T", " ").replace("Z", ""))}</span>
                  <span class="dt-history__meta">${esc((h.wall_seconds || 0).toFixed(2))}s · sub ${h.indicators?.subdomains?.length || 0} · ip ${
                    h.indicators?.ips?.length || 0
                  }</span>
                </button>`
              )
              .join("")}
          </div>
        </div>`
      : "";

    el.innerHTML = histHtml + `<div class="overview-grid">${CATEGORIES.map((cat) => `
      <div class="overview-card">
        <div class="overview-card-header">${CAT_ICONS[cat]}<span>${esc(cat)}</span></div>
        ${TOOLS.filter((t) => t.cat === cat)
          .map(
            (t) => `
          <div class="overview-tool">
            <div class="overview-tool-name" style="color:${t.color}">${esc(t.name)}</div>
            <div class="overview-tool-desc">${esc(t.desc)}</div>
            ${t.sources ? `<div class="overview-sources">${t.sources.map((s) => `<span class="overview-src">${esc(s)}</span>`).join("")}</div>` : ""}
          </div>`
          )
          .join("")}
      </div>`).join("")}</div>`;

    if (hist.length) {
      const btnClear = document.getElementById("btnClearHistory");
      if (btnClear) {
        btnClear.addEventListener("click", () => {
          try {
            localStorage.removeItem(HISTORY_KEY);
          } catch (_) {}
          render();
        });
      }
      el.querySelectorAll("[data-hist-id]").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-hist-id");
          const item = loadHistory().find((x) => x.id === id);
          if (item) applyReport(item);
        });
      });
    }
    return;
  }

  const toolResults = TOOLS.filter((t) => results[t.id] && selectedTools.has(t.id))
    .map((t) => ({ toolId: t.id, output: results[t.id]?.output || "", flags: extractIndicators(domain, results[t.id]?.output || "").flags }));
  const indicatorsByTool = toolResults.map((r) => extractIndicators(domain, r.output));

  const summaryHtml = renderDomainSummary({ domain, indicatorsByTool, wallSeconds: lastWallSeconds || 0 });
  const indicatorsHtml = renderIndicatorsOverview({ domain, indicatorsByTool });
  const rep = lastReport || buildReportData();
  const nextStepsHtml = renderNextStepsBlock(rep);

  el.innerHTML =
    summaryHtml +
    indicatorsHtml +
    nextStepsHtml +
    CATEGORIES.map((cat) => {
    const catTools = TOOLS.filter((t) => t.cat === cat);
    const hasAny = catTools.some((t) => running.has(t.id) || doneSet.has(t.id) || errSet.has(t.id) || results[t.id]);
    if (!hasAny) return "";
    return `<div class="category">
      <div class="category-header">${CAT_ICONS[cat]}<span class="category-name">${esc(cat)}</span></div>
      ${catTools.map((t) => renderCard(t)).join("")}
    </div>`;
  }).join("");

  wireCopyButtons(el);
  wireNextSteps(el);

  const f = document.getElementById("dtFilter");
  if (f) {
    f.addEventListener("input", () => {
      filterText = f.value || "";
      render();
    });
  }

  const btnCopy = document.getElementById("btnCopyIndicators");
  if (btnCopy) {
    btnCopy.addEventListener("click", () => {
      const rep = lastReport || buildReportData();
      const ind = rep.indicators || {};
      const text = [
        `# ${rep.domain}`,
        "",
        "[SUBDOMAINS]",
        ...(ind.subdomains || []),
        "",
        "[IPS]",
        ...(ind.ips || []),
        "",
        "[EMAILS]",
        ...(ind.emails || []),
        "",
        "[URLS]",
        ...(ind.urls || []),
      ].join("\n");
      copyText(text);
    });
  }

  const expMD = document.getElementById("btnExportMD");
  const expJSON = document.getElementById("btnExportJSON");
  const expTXT = document.getElementById("btnExportTXT");
  if (expMD) expMD.addEventListener("click", () => downloadTextFile(`domain_${rep.domain}_${Date.now()}.md`, "text/markdown;charset=utf-8", reportToMarkdown(rep)));
  if (expTXT) expTXT.addEventListener("click", () => downloadTextFile(`domain_${rep.domain}_${Date.now()}.txt`, "text/plain;charset=utf-8", reportToText(rep)));
  if (expJSON) expJSON.addEventListener("click", () => downloadTextFile(`domain_${rep.domain}_${Date.now()}.json`, "application/json;charset=utf-8", JSON.stringify(rep, null, 2)));
}

function renderCard(tool) {
  const isR = running.has(tool.id),
    isD = doneSet.has(tool.id),
    isE = errSet.has(tool.id),
    isC = collapsedSet.has(tool.id);
  const d = results[tool.id];
  if (!isR && !isD && !isE && !d) return "";

  const cls = isR ? "running" : isD && isE ? "error" : isD ? "done" : isE ? "error" : "";
  const iconCls = isR ? "running" : isD && isE ? "error" : isD ? "done" : isE ? "error" : "";
  let iconHtml;
  if (isR) iconHtml = `<span class="spinner" style="color:var(--amber)">${IC.loader}</span>`;
  else if (isD && !isE) iconHtml = `<span style="color:var(--emerald)">${IC.check}</span>`;
  else if (isE) iconHtml = `<span style="color:var(--red)">${IC.xcirc}</span>`;
  else iconHtml = `<span style="color:${tool.color}">${TOOL_SVG[tool.id] || ""}</span>`;

  const content = isD && !isC && d ? renderContent(tool, d) : "";

  return `<div class="tool-card ${cls}">
    <div class="tool-header">
      <div class="tool-icon ${iconCls}">${iconHtml}</div>
      <div style="flex:1;min-width:0"><p class="tool-name">${esc(tool.name)}</p><p class="tool-desc">${esc(tool.desc)}</p></div>
      <div class="tool-actions">
        ${isR ? '<span class="tool-status">анализ...</span>' : ""}
        ${
          isD
            ? `<button class="tool-btn" onclick="collapsedSet.${isC ? "delete" : "add"}('${tool.id}');render()">${isC ? IC.chevDown : IC.chevUp}</button>`
            : ""
        }
        ${(isD || isE) ? `<button class="tool-btn" onclick="rerunTool('${tool.id}')" ${isR ? "disabled" : ""}>${IC.retry}</button>` : ""}
      </div>
    </div>
    ${content}
  </div>`;
}

function renderTags(items, cls) {
  const q = (filterText || "").trim().toLowerCase();
  const arr = [...items].filter((x) => !q || String(x).toLowerCase().includes(q));
  if (!arr.length) return "";
  const list = arr.slice(0, 40);
  const more = arr.length > list.length ? `<span class="tag ${cls}">+${arr.length - list.length}</span>` : "";
  return `<div class="tag-list">${list.map((x) => `<span class="tag ${cls}">${esc(x)}</span>`).join("")}${more}</div>`;
}

function renderToolParsedTables(tool, d) {
  const raw = String(d.output || "");
  let html = "";
  if (tool.id === "domain-search") {
    const p = parseDomainSearchOutput(raw);
    if (p.ip) {
      html += `<div class="section-label" style="color:var(--sky)">${IC.pin} IP из сводки</div>`;
      html += renderDataTable(["Поле", "Значение"], [["IP", p.ip], ["Shodan host", `https://www.shodan.io/host/${p.ip}`]], "dt-table--compact");
    }
    if (p.dnsRows.length) {
      html += `<div class="section-label">${IC.db} DNS (из блока)</div>`;
      html += renderDataTable(
        ["Тип", "Значение"],
        p.dnsRows.map((r) => [r.type, r.value]),
        "dt-table--dns"
      );
    }
    if (p.whoisRows.length) {
      html += `<div class="section-label">WHOIS (первые поля)</div>`;
      html += renderDataTable(
        ["Поле", "Значение"],
        p.whoisRows.map((r) => [r.key, r.value]),
        "dt-table--whois"
      );
    }
  }
  if (tool.id === "dnsx") {
    const rows = parseDnsxOutput(raw);
    if (rows.length) {
      html += `<div class="section-label">${IC.db} Распарсенные записи dnsx</div>`;
      html += renderDataTable(
        ["Хост", "Тип", "Значение"],
        rows.slice(0, 200).map((r) => [r.host, r.type, r.value]),
        "dt-table--dnsx"
      );
      if (rows.length > 200) html += `<p class="dt-table-note">Показано 200 из ${rows.length}</p>`;
    }
  }
  if (tool.id === "subfinder") {
    const hosts = parseSubfinderOutput(raw);
    if (hosts.length) {
      html += `<div class="section-label">${IC.net} Поддомены (строки)</div>`;
      html += renderDataTable(
        ["Поддомен"],
        hosts.slice(0, 300).map((h) => [h]),
        "dt-table--subfinder"
      );
      if (hosts.length > 300) html += `<p class="dt-table-note">Показано 300 из ${hosts.length}</p>`;
    }
  }
  return html;
}

function renderContent(tool, d) {
  let h = '<div class="tool-content">';
  if (tool.sources) h += `<div class="sources">${tool.sources.map((s) => `<span class="source-tag">${esc(s)}</span>`).join("")}</div>`;

  h += renderToolParsedTables(tool, d);

  const ind = extractIndicators(domain, d.output);
  if (ind.subs.size) h += `<div class="section-label" style="color:var(--violet)">${IC.net} Поддомены</div>${renderTags(ind.subs, "tag-violet")}`;
  if (ind.ips.size) h += `<div class="section-label" style="color:var(--sky)">${IC.pin} IP адреса</div>${renderTags(ind.ips, "tag-sky")}`;
  if (ind.emails.size) h += `<div class="section-label" style="color:var(--amber)">${IC.mail} Emails</div>${renderTags(ind.emails, "tag-amber")}`;
  if (ind.urls.size) h += `<div class="section-label" style="color:var(--emerald)">${IC.db} URL</div>${renderTags(ind.urls, "tag-emerald")}`;

  const out = String(d.output || "");
  const q = (filterText || "").trim().toLowerCase();
  const out2 = q
    ? out
        .split("\n")
        .filter((ln) => ln.toLowerCase().includes(q))
        .slice(0, 4000)
        .join("\n") || "(нет строк по фильтру)"
    : out;
  h += `<div class="tool-output"><pre>${esc(out2)}</pre></div>`;
  h += "</div>";
  return h;
}

render();

