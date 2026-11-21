/* OSINT Panel — persistent local workspace (browser-local, user controlled). */
(function () {
  "use strict";
  var KEY = "osint-panel-workspace-v1", MAX_ITEMS = 40, MAX_TEXT = 12000;
  var css = "#osint-workspace-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".osint-ws-action{font:inherit;font-size:12px;color:#dce8f5;background:#0a1623;border:1px solid #294056;border-radius:8px;padding:7px 10px;cursor:pointer}" +
    ".osint-ws-action:hover{border-color:#59b8f5;color:#59b8f5}" +
    "#osint-ws-toggle{position:fixed;right:18px;bottom:18px;z-index:9998;box-shadow:0 8px 28px #0008}" +
    "#osint-ws-count{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:5px;border-radius:20px;background:#59b8f5;color:#07111b;font-size:10px;font-weight:800}" +
    "#osint-ws-panel{position:fixed;z-index:9999;right:18px;bottom:64px;width:min(440px,calc(100vw - 28px));max-height:min(70vh,680px);display:none;flex-direction:column;background:#0b1420;border:1px solid #294056;border-radius:14px;box-shadow:0 18px 60px #000b;color:#e7eef7;overflow:hidden}" +
    "#osint-ws-panel.open{display:flex}.osint-ws-head{display:flex;align-items:center;gap:8px;padding:13px 14px;border-bottom:1px solid #26384a}" +
    ".osint-ws-head strong{font-size:14px;flex:1}.osint-ws-note{padding:8px 14px;color:#9db0c3;font-size:11px;border-bottom:1px solid #1d3041}" +
    "#osint-ws-list{overflow:auto;padding:10px;display:grid;gap:9px}.osint-ws-item{border:1px solid #26384a;border-radius:10px;padding:10px;background:#101d2b;min-width:0}" +
    ".osint-ws-item-head{display:flex;gap:8px;align-items:center;margin-bottom:7px}.osint-ws-item-head strong{font-size:12px;flex:1;overflow-wrap:anywhere}" +
    ".osint-ws-meta{font-size:10px;color:#8fa4b8}.osint-ws-preview{font:11px/1.5 ui-monospace,monospace;color:#c5d2df;white-space:pre-wrap;overflow-wrap:anywhere;max-height:115px;overflow:auto;margin:0}" +
    ".osint-ws-controls{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.osint-ws-save{margin:6px 0 0 6px!important;font-size:11px!important;padding:5px 8px!important}" +
    "#osint-workspace-actions #osint-ws-toggle{position:static;box-shadow:none}" +
    ".osint-header{font-family:Inter,ui-sans-serif,system-ui,sans-serif!important;background:rgba(7,13,21,.96)!important;border-bottom:1px solid #26384a!important}" +
    ".osint-header-inner{min-height:62px;padding:10px clamp(12px,2vw,26px)!important;gap:14px!important;align-items:center!important}" +
    ".osint-title h1,.osint-header h1{font-family:Inter,ui-sans-serif,system-ui,sans-serif!important;font-size:clamp(17px,2vw,21px)!important;line-height:1.2!important;letter-spacing:.02em!important;margin:0!important}" +
    ".osint-title p{font-size:11px!important;line-height:1.35!important;margin:3px 0 0!important;color:#91a5b9!important}" +
    ".osint-tabs{padding:0 clamp(10px,2vw,24px)!important;background:#0a1420!important;border-top:1px solid #182a3b!important}" +
    ".tab-nav{display:flex!important;align-items:center!important;gap:5px!important;overflow-x:auto!important;scrollbar-width:thin!important}" +
    ".tab-nav .tool-link{display:inline-flex!important;align-items:center!important;gap:7px!important;min-height:38px!important;padding:8px 11px!important;border-radius:8px 8px 0 0!important;font:500 12px/1.2 Inter,ui-sans-serif,system-ui,sans-serif!important;white-space:nowrap!important;text-decoration:none!important}" +
    ".tab-nav .tool-link .tab-icon,.tab-nav .tool-link svg{width:15px!important;height:15px!important;flex:0 0 15px!important}" +
    ".app-header-right{gap:8px!important;align-items:center!important}" +
    "@media(max-width:640px){#osint-ws-toggle{right:10px;bottom:10px}#osint-ws-panel{right:8px;bottom:58px;width:calc(100vw - 16px)}}";
  var style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  function read() {
    try { var value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  }
  function write(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS))); return true; }
    catch (_) { return false; }
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function pageName() {
    var h = document.querySelector("main h1, main h2, .tool-cli-header h2, .osint-title h1");
    return (h && h.textContent || document.title || "OSINT Panel").trim().slice(0, 90);
  }
  function render() {
    var items = read(), count = document.getElementById("osint-ws-count"), list = document.getElementById("osint-ws-list");
    if (count) count.textContent = String(items.length);
    if (!list) return;
    if (!items.length) { list.innerHTML = '<div class="osint-ws-note">Пока ничего не закреплено. Нажми «В рабочую область» возле результата.</div>'; return; }
    list.innerHTML = items.map(function (item) {
      return '<article class="osint-ws-item" data-ws-id="' + esc(item.id) + '">' +
        '<div class="osint-ws-item-head"><strong>' + esc(item.title) + '</strong><span class="osint-ws-meta">' + esc(item.time) + '</span></div>' +
        '<div class="osint-ws-meta">' + esc(item.page) + '</div><pre class="osint-ws-preview">' + esc(item.text.slice(0, 1800)) + '</pre>' +
        '<div class="osint-ws-controls"><button class="osint-ws-action" data-ws-copy>Копировать</button><button class="osint-ws-action" data-ws-delete>Удалить</button></div></article>';
    }).join("");
  }
  function saveResult(node, button) {
    var cleanNode = node.cloneNode(true);
    cleanNode.querySelectorAll("[data-ws-save]").forEach(function (el) { el.remove(); });
    var text = (cleanNode.innerText || cleanNode.textContent || "").trim();
    if (text.length < 20) return;
    var titleNode = node.querySelector("h1,h2,h3,.tool-results-card__title,.card-header");
    var title = (titleNode && titleNode.textContent || pageName()).trim().slice(0, 100);
    var items = read(), signature = location.pathname + "|" + title + "|" + text.slice(0, 500);
    var btn = button;
    if (items.some(function (x) { return x.signature === signature; })) {
      if (btn) { btn.textContent = "Уже закреплено"; btn.disabled = true; } return;
    }
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random());
    items.unshift({id:id,signature:signature,title:title,page:pageName(),time:new Date().toLocaleString(),text:text.slice(0,MAX_TEXT),url:location.pathname});
    if (!write(items)) { alert("Не удалось сохранить: хранилище браузера заполнено или недоступно."); return; }
    render(); if (btn) { btn.textContent = "Закреплено ✓"; btn.disabled = true; }
  }
  function addSaveButtons(root) {
    var selector = ".tool-results-card,.result-box,.iprdap-result,.tool-cli-output,.tool-output,.result-output,[data-result-output]";
    var nodes = [];
    if (root.matches && root.matches(selector)) nodes.push(root);
    if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll(selector), function (n) { nodes.push(n); });
    nodes.forEach(function (node) {
      if (node.dataset.wsObserved === "1" || node.closest("#osint-ws-panel")) return;
      if ((node.innerText || node.textContent || "").trim().length < 20) return;
      node.dataset.wsObserved = "1";
      var host = node.querySelector(".tool-results-card__header,.card-header");
      var btn = document.createElement("button"); btn.type = "button";
      btn.className = "osint-ws-action osint-ws-save"; btn.textContent = "В рабочую область"; btn.dataset.wsSave = "1";
      btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); saveResult(node, btn); });
      if (host) host.appendChild(btn); else node.insertAdjacentElement("afterend", btn);
    });
  }
  var NAV_ITEMS = [
    ["domain-tools", "Домены", "/modules/domain-workspace/"],
    ["username-tools", "Username", "/modules/username-workspace/"],
    ["photo-search", "Фото", "/modules/photo-workspace/"],
    ["ip-rdap", "IP / RDAP", "/modules/ip-rdap/"],
    ["grabcam", "GrabCam", "/modules/grabcam/"],
    ["ai-agent", "ИИ", "/modules/ai-agent/"],
    ["google-osint", "Email OSINT", "/modules/google-osint/"],
    ["history", "История", "/modules/history/"],
    ["settings", "Настройки", "/p/settings/"]
  ];
  function ensureUnifiedNav() {
    // Domain workspace intentionally has no secondary section strip.
    if (document.body && document.body.classList.contains("domain-standalone")) return;
    var header = document.querySelector(".app-header");
    if (!header) return;
    var nav = document.getElementById("nav-tools");
    if (nav && nav.querySelectorAll("[data-tool-id]").length) return;
    if (!nav) {
      var tabs = document.createElement("div"); tabs.className = "osint-tabs";
      nav = document.createElement("nav"); nav.id = "nav-tools"; nav.className = "tab-nav";
      nav.setAttribute("aria-label", "Разделы"); tabs.appendChild(nav); header.appendChild(tabs);
    }
    if (nav.querySelectorAll("[data-osint-nav]").length === NAV_ITEMS.length) return;
    nav.innerHTML = NAV_ITEMS.map(function (item) {
      var active = location.pathname === item[2] || location.pathname.indexOf(item[2]) === 0;
      return '<a href="' + item[2] + '" class="tool-link' + (active ? ' active' : '') + '" data-tool-id="' + item[0] + '" data-osint-nav="1">' + item[1] + '</a>';
    }).join("");
  }
  function ensureSidebarLayout() {
    if (document.body && document.body.classList.contains("iprdap-standalone")) return;
    if (document.getElementById("app-sidebar")) return;
    var header = document.querySelector(".app-header");
    if (!header) return;
    var nav = document.getElementById("nav-tools");
    if (!nav) return;
    var tabs = nav.closest(".osint-tabs");
    var appBody = document.querySelector(".app-body");
    if (!appBody) {
      var main = document.querySelector("main.main");
      if (!main || !main.parentNode) return;
      appBody = document.createElement("div");
      appBody.className = "app-body osint-body";
      main.parentNode.insertBefore(appBody, main);
      appBody.appendChild(main);
    }
    appBody.id = "app-shell";
    var sidebar = document.createElement("aside");
    sidebar.className = "app-sidebar";
    sidebar.id = "app-sidebar";
    sidebar.setAttribute("aria-label", "Основная навигация");
    sidebar.innerHTML = '<div class="sidebar-heading"><span>РАБОЧЕЕ ПРОСТРАНСТВО</span><button type="button" id="sidebar-collapse" class="sidebar-collapse" aria-label="Свернуть меню" aria-pressed="false">‹</button></div><div class="sidebar-foot"><span class="sidebar-foot-dot"></span><span class="sidebar-foot-copy">Локальная среда · OSINT Panel</span></div>';
    sidebar.insertBefore(nav, sidebar.querySelector(".sidebar-foot"));
    if (tabs) tabs.remove();
    appBody.insertBefore(sidebar, appBody.firstChild);
    var backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "sidebar-backdrop";
    backdrop.id = "sidebar-backdrop";
    backdrop.setAttribute("aria-label", "Закрыть навигацию");
    backdrop.tabIndex = -1;
    appBody.insertBefore(backdrop, sidebar.nextSibling);
    var headerRight = header.querySelector(".app-header-right") || header.querySelector(".osint-header-inner");
    if (headerRight && !document.getElementById("sidebar-toggle")) {
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "sidebar-toggle";
      toggle.id = "sidebar-toggle";
      toggle.setAttribute("aria-controls", "app-sidebar");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Открыть навигацию");
      toggle.innerHTML = '<span aria-hidden="true">☰</span><span class="sidebar-toggle-label">Меню</span>';
      headerRight.prepend(toggle);
    }
    var shell = appBody;
    var openButton = document.getElementById("sidebar-toggle");
    var collapseButton = document.getElementById("sidebar-collapse");
    var closeMobile = function () {
      shell.classList.remove("sidebar-open");
      if (openButton) openButton.setAttribute("aria-expanded", "false");
    };
    var collapsed = false;
    try { collapsed = localStorage.getItem("osint-sidebar-collapsed") === "1"; } catch (_) {}
    shell.classList.toggle("sidebar-collapsed", collapsed);
    collapseButton.setAttribute("aria-pressed", String(collapsed));
    collapseButton.textContent = collapsed ? "›" : "‹";
    openButton.addEventListener("click", function () {
      var open = shell.classList.toggle("sidebar-open");
      openButton.setAttribute("aria-expanded", String(open));
    });
    collapseButton.addEventListener("click", function () {
      collapsed = !shell.classList.contains("sidebar-collapsed");
      shell.classList.toggle("sidebar-collapsed", collapsed);
      collapseButton.setAttribute("aria-pressed", String(collapsed));
      collapseButton.textContent = collapsed ? "›" : "‹";
      try { localStorage.setItem("osint-sidebar-collapsed", collapsed ? "1" : "0"); } catch (_) {}
    });
    backdrop.addEventListener("click", closeMobile);
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeMobile(); });
    window.addEventListener("resize", function () { if (window.innerWidth > 760) closeMobile(); });
    nav.querySelectorAll(".tool-link").forEach(function (link) {
      link.addEventListener("click", closeMobile);
    });
  }
  function mount() {
    ensureUnifiedNav();
    // Keep the compact top navigation. Do not create a sidebar on module pages.
    var header = document.querySelector(".app-header-right") || document.querySelector(".osint-header-inner");
    if (header && !document.getElementById("osint-workspace-actions")) {
      var actions = document.createElement("div"); actions.id = "osint-workspace-actions";
      actions.innerHTML = '<button class="osint-ws-action" id="osint-ws-back" type="button">← Назад</button><a class="osint-ws-action" href="/" title="Вернуться на главную">Главная</a><button class="osint-ws-action" id="osint-ws-toggle" type="button">Рабочая область <span id="osint-ws-count">0</span></button>';
      if (location.pathname === "/" || location.pathname === "/index.html") actions.querySelector("#osint-ws-back").hidden = true;
      header.prepend(actions);
    }
    var panel = document.createElement("section"); panel.id = "osint-ws-panel"; panel.setAttribute("aria-label","Сохранённые результаты");
    panel.innerHTML = '<div class="osint-ws-head"><strong>Моя рабочая область</strong><button class="osint-ws-action" id="osint-ws-clear" type="button">Очистить</button><button class="osint-ws-action" id="osint-ws-close" type="button" aria-label="Закрыть">×</button></div><div class="osint-ws-note">Результаты хранятся только в этом браузере на этом компьютере. Закрепляй только нужные данные.</div><div id="osint-ws-list"></div>';
    document.body.appendChild(panel);
    var toggle = document.getElementById("osint-ws-toggle");
    if (!toggle) { toggle = document.createElement("button"); toggle.id = "osint-ws-toggle"; toggle.className = "osint-ws-action"; toggle.type = "button"; toggle.innerHTML = 'Рабочая область <span id="osint-ws-count">0</span>'; document.body.appendChild(toggle); }
    var back = document.getElementById("osint-ws-back");
    if (back) back.addEventListener("click", function () {
      var referrer = document.referrer;
      if (referrer && new URL(referrer).origin === location.origin && history.length > 1) history.back();
      else location.href = "/";
    });
    toggle.addEventListener("click", function () { panel.classList.toggle("open"); render(); });
    document.getElementById("osint-ws-close").addEventListener("click", function () { panel.classList.remove("open"); });
    document.getElementById("osint-ws-clear").addEventListener("click", function () {
      if (confirm("Удалить все закреплённые результаты из локальной рабочей области?")) { write([]); render(); }
    });
    panel.addEventListener("click", async function (e) {
      var item = e.target.closest(".osint-ws-item"); if (!item) return;
      var id = item.dataset.wsId;
      if (e.target.closest("[data-ws-delete]")) { write(read().filter(function (x) { return x.id !== id; })); render(); }
      if (e.target.closest("[data-ws-copy]")) {
        var record = read().find(function (x) { return x.id === id; });
        if (record) { try { await navigator.clipboard.writeText(record.text); e.target.textContent = "Скопировано"; } catch (_) { e.target.textContent = "Ошибка"; } }
      }
    });
    render(); addSaveButtons(document);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.target && record.target.nodeType === 1) addSaveButtons(record.target);
        record.addedNodes.forEach(function (node) { if (node.nodeType === 1) addSaveButtons(node); });
      });
    });
    observer.observe(document.body, {childList:true,subtree:true});
    var nav = document.getElementById("nav-tools");
    if (nav) new MutationObserver(ensureUnifiedNav).observe(nav, {childList:true});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, {once:true}); else mount();
})();