import { initPanel } from "/js/tools/tool-anonsms.js";
const root = document.getElementById("panel-anonsms");
if (root && typeof initPanel === "function") initPanel(root);
