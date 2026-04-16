export function wireUserMenu() {
  const btnUser = document.getElementById("btn-user-menu");
  const userMenu = document.getElementById("user-menu");
  if (!btnUser || !userMenu) return;

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

