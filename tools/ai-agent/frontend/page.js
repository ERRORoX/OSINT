import { initPanel } from "/js/tools/tool-ai-agent.js";
const root = document.getElementById("panel-ai-agent");
if (root && typeof initPanel === "function") initPanel(root);
