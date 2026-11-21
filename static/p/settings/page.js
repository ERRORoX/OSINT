import { initPanel } from "/js/settings.js";
const root = document.getElementById("panel-settings");
if (root && typeof initPanel === "function") initPanel(root);
