import { initPanel } from "/js/tools/tool-instagram-bruter.js";
const root = document.getElementById("panel-instagram-bruter");
if (root && typeof initPanel === "function") initPanel(root);
