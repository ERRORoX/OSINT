/**
 * Единая логика шапки для всех страниц:
 * - меню профиля (Admin) открыть/закрыть
 * - активная вкладка в навигации по URL
 */
(function () {
  function initUserMenu() {
    const btnUser = document.getElementById("btn-user-menu");
    const userMenu = document.getElementById("user-menu");
    if (!btnUser || !userMenu) return;
    if (btnUser.dataset.menuInited === "1") return;
    btnUser.dataset.menuInited = "1";

    btnUser.addEventListener("click", () => {
      const open = btnUser.getAttribute("aria-expanded") === "true";
      btnUser.setAttribute("aria-expanded", String(!open));
      userMenu.hidden = open;
    });

    document.addEventListener("click", (e) => {
      if (!btnUser.contains(e.target) && !userMenu.contains(e.target)) {
        btnUser.setAttribute("aria-expanded", "false");
        userMenu.hidden = true;
      }
    });
  }

  function normalizePath(p) {
    let s = String(p || "/");
    if (!s.startsWith("/")) s = "/" + s;
    return s.endsWith("/") ? s : s + "/";
  }

  function initActiveTab() {
    const nav = document.getElementById("nav-tools");
    if (!nav) return;

    const cur = normalizePath(location.pathname || "/");
    const links = Array.from(nav.querySelectorAll("a.tool-link"));
    if (!links.length) return;

    let best = null;
    let bestLen = -1;
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/")) continue;
      const hp = normalizePath(href);
      if (cur === hp || cur.startsWith(hp)) {
        if (hp.length > bestLen) {
          best = a;
          bestLen = hp.length;
        }
      }
    }

    links.forEach((a) => a.classList.remove("active"));
    if (best) best.classList.add("active");
  }

  function run() {
    initUserMenu();
    initActiveTab();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();

