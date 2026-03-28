/**
 * Карта: показать точку, очистить.
 */
import { state } from "../state.js";
import { escapeHtml } from "../utils.js";
import { loadLeaflet } from "../utils.js";

export function showLocationOnMap(container, lat, lon, label, ip) {
  const el = container.querySelector("#gc-map");
  const tooltipEl = container.querySelector("#gc-map-ip-tooltip");
  const tooltipValue = container.querySelector("#gc-map-ip-value");
  if (!el) return;
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || isNaN(lonNum)) return;
  if (tooltipEl && tooltipValue) {
    tooltipValue.textContent = ip || (label && label.split(" — ")[0]) || "";
    tooltipEl.style.display = ip || label ? "block" : "none";
  }
  el.className = "gc-map-canvas";
  el.innerHTML = "<p class=\"gc-map-caption\">" + escapeHtml(label || "") + '</p><a href="https://www.openstreetmap.org/?mlat=' + latNum + "&mlon=" + lonNum + '&zoom=14" target="_blank" rel="noopener" class="gc-map-link">Открыть в OSM</a><div id="gc-map-container"></div>';
  const mapContainer = el.querySelector("#gc-map-container");
  if (!mapContainer) return;
  function renderMap() {
    if (state.mapInstance) {
      state.mapInstance.remove();
      state.mapInstance = null;
    }
    state.mapInstance = L.map("gc-map-container").setView([latNum, lonNum], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(state.mapInstance);
    L.marker([latNum, lonNum]).addTo(state.mapInstance);
  }
  if (typeof L !== "undefined") {
    renderMap();
  } else {
    mapContainer.innerHTML = "<span class=\"gc-map-placeholder\">Загрузка карты…</span>";
    loadLeaflet(renderMap);
  }
}

export function clearMap(container) {
  const el = container.querySelector("#gc-map");
  const tooltipEl = container.querySelector("#gc-map-ip-tooltip");
  if (!el) return;
  if (state.mapInstance) {
    state.mapInstance.remove();
    state.mapInstance = null;
  }
  if (tooltipEl) tooltipEl.style.display = "none";
  el.innerHTML = "<span class=\"gc-map-placeholder\">Выберите местоположение ниже или запустите сессию.</span>";
  el.className = "gc-map-canvas gc-map-empty";
}

export function initMap(container) {
  container.querySelector("#gc-btn-map")?.addEventListener("click", () => clearMap(container));
}
