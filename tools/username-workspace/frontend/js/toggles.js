import { TOOL_DEFS } from "./consts.js";

export function syncToolCards() {
  document.querySelectorAll(".js-tool-toggle").forEach((inp) => {
    const lab = inp.closest("label.osint-tool-card");
    if (lab) lab.classList.toggle("active", inp.checked);
  });
}

export function wireToolToggles() {
  document.querySelectorAll(".js-tool-toggle").forEach((inp) => {
    inp.addEventListener("change", () => syncToolCards());
  });

  const on = document.getElementById("btnToolsAllOn");
  const off = document.getElementById("btnToolsAllOff");
  if (on) {
    on.addEventListener("click", () => {
      document.querySelectorAll(".js-tool-toggle").forEach((el) => {
        el.checked = true;
      });
      syncToolCards();
    });
  }
  if (off) {
    off.addEventListener("click", () => {
      document.querySelectorAll(".js-tool-toggle").forEach((el) => {
        el.checked = false;
      });
      syncToolCards();
    });
  }
  syncToolCards();
}

export function getEnabledTools() {
  return TOOL_DEFS.filter((t) => document.getElementById(t.toggleId)?.checked);
}

