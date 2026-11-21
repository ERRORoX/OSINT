import { initPanel } from "/js/tools/tool-google-osint.js";
const root = document.getElementById("panel-google-osint");
if (root && typeof initPanel === "function") initPanel(root);
