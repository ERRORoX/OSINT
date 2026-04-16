/**
 * Главная страница: навигация и карточки — отдельные разделы на /p/<id>/ (один HTML/CSS/JS на инструмент).
 */

const API = "/api";

const TAB_ICONS = {
  "domain-tools":
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  "username-tools":
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  "ai-agent":
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><line x1="12" y1="5" x2="12" y2="18"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/><circle cx="12" cy="12" r="4"/></svg>',
  history:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
  "photo-search":
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  grabcam:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
};

const DOMAIN_TOOLS_IDS = ["theharvester", "domain-search", "shodan", "subfinder", "dnsx"];
const USERNAME_TOOLS_IDS = ["sherlock", "maigret", "social-analyzer", "blackbird"];
const TAB_ONLY_TOOL_IDS = ["photo-search"];

const HUB_CARDS = [
  { id: "domain-tools", href: "/domain/", title: "Домен", desc: "WHOIS, поддомены, Shodan, theHarvester" },
  { id: "username-tools", href: "/username/", title: "Username", desc: "Sherlock, Maigret, соцсети" },
  { id: "photo-search", href: "/photo/", title: "Поиск по фото", desc: "Обратный поиск изображений" },
  { id: "google-osint", href: "/p/google-osint/", title: "Google OSINT", desc: "Holehe и h8mail по email" },
  { id: "ai-agent", href: "/p/ai-agent/", title: "ИИ-помощник", desc: "Автоматизация и подсказки" },
  { id: "history", href: "/p/history/", title: "История", desc: "Запуски и результаты" },
  { id: "anonsms", href: "/p/anonsms/", title: "ANONSMS", desc: "Отправка SMS (Textbelt)" },
  { id: "instagram-bruter", href: "/p/instagram-bruter/", title: "Instagram", desc: "Bruter / перебор" },
  { id: "grabcam", href: "/p/grabcam/", title: "Grabcam", desc: "Сессии, фото, геолокация" },
  { id: "settings", href: "/p/settings/", title: "API ключи", desc: "Сохранение в .env" },
];

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function loadTools() {
  const res = await fetch(`${API}/tools`);
  if (!res.ok) throw new Error("Не удалось загрузить список инструментов");
  return res.json();
}

function iconSpan(id) {
  const svg = TAB_ICONS[id];
  return svg ? `<span class="tab-icon" aria-hidden="true">${svg}</span>` : "";
}

function renderNav(tools) {
  const nav = document.getElementById("nav-tools");
  const rest = tools.filter(
    (t) =>
      !DOMAIN_TOOLS_IDS.includes(t.id) &&
      !USERNAME_TOOLS_IDS.includes(t.id) &&
      !TAB_ONLY_TOOL_IDS.includes(t.id)
  );
  const mk = (id, label, href) => {
    const h = href || `/p/${id}/`;
    return `<a href="${h}" class="tool-link" data-tool-id="${id}">${iconSpan(id)}${escapeHtml(label)}</a>`;
  };
  const toolLinks = rest.map((t) => mk(t.id, t.name)).join("");
  nav.innerHTML =
    mk("domain-tools", "Домен", "/domain/") +
    mk("username-tools", "Username", "/username/") +
    mk("photo-search", "Фото", "/photo/") +
    mk("ai-agent", "ИИ") +
    mk("history", "История") +
    toolLinks;
}

function renderHubCards() {
  const host = document.getElementById("hub-cards");
  if (!host) return;
  host.innerHTML = HUB_CARDS.map(
    (c) => `
    <a class="hub-card" href="${escapeHtml(c.href)}">
      <div class="hub-card-title">${escapeHtml(c.title)}</div>
      <p class="hub-card-desc">${escapeHtml(c.desc)}</p>
    </a>`
  ).join("");
}

function wireHeader() {
  const menuSettings = document.querySelector("#user-menu .app-header-user-menu-item[data-tool-id]");
  if (menuSettings) menuSettings.setAttribute("href", "/p/settings/");

  const btnUser = document.getElementById("btn-user-menu");
  const userMenu = document.getElementById("user-menu");
  if (btnUser && userMenu) {
    btnUser.addEventListener("click", () => {
      const open = btnUser.getAttribute("aria-expanded") === "true";
      btnUser.setAttribute("aria-expanded", !open);
      userMenu.hidden = open;
    });
    document.addEventListener("click", (e) => {
      if (!btnUser.contains(e.target) && !userMenu.contains(e.target)) {
        btnUser.setAttribute("aria-expanded", "false");
        userMenu.hidden = true;
      }
    });
  }
}

async function init() {
  const tools = await loadTools();
  renderNav(tools);
  renderHubCards();
  wireHeader();
}

init().catch((e) => {
  const msg = e.message || "Нет связи с сервером";
  document.body.innerHTML = `<div class="init-error"><p><strong>Ошибка загрузки:</strong> ${escapeHtml(msg)}</p><p>Запустите сервер из корня проекта: <code>python run.py</code></p></div>`;
});
