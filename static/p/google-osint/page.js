import { initPanel } from "/js/tools/tool-google-osint.js";
const root = document.getElementById("panel-google-osint");
if (root && typeof initPanel === "function") initPanel(root);

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
