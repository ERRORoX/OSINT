import { initPanel } from "/grabcam/panel/js/tool-grabcam.js";
const root = document.getElementById("panel-grabcam");
if (root && typeof initPanel === "function") initPanel(root);
