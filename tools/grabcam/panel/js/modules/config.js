/** Конфигурация безопасной учебной панели GrabCam. */
export const TOOL_ID = "grabcam";
export const LAYOUT_STORAGE_KEY = "grabcam-panel-layout";
export const MIN_SPAN = 1;
export const MAX_SPAN = 4;
export const API = {
  runStatus: "/api/tools/grabcam/run-status",
  stop: "/api/tools/grabcam/stop",
};
export const POLL_INTERVALS = { status: 2000 };
export const POLL_IDS = { status: null };
export const METHOD_HINTS = {
  php_only: "Сервер доступен только на этом компьютере через 127.0.0.1.",
  localhost_run: "Публичная HTTPS-ссылка через SSH. Требуется установленный OpenSSH.",
  cloudflared: "Публичная HTTPS-ссылка через cloudflared. Требуется установленный cloudflared.",
  serveo: "Публичная HTTPS-ссылка через SSH. Доступность Serveo зависит от сети.",
};
