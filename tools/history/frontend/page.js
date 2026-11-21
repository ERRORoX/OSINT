import { initPanel } from "/js/tools/tool-history.js";
const root = document.getElementById("panel-history");
if (root && typeof initPanel === "function") initPanel(root);
