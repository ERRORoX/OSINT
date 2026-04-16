/**
 * Карта Grabcam: MapLibre GL JS + векторные стили (без ключей по умолчанию).
 * Пресеты:
 *   "session"    — OpenFreeMap Liberty (3D); тёмный вид задаётся в CSS (фильтр канваса).
 *   "darkmatter" — Carto Dark Matter GL.
 *   "midnight"   — Carto Voyager GL.
 *   "void"       — Dark Matter GL + лёгкое затемнение в CSS.
 * Смена: константа GC_MAP_STYLE ниже.
 */
import { state } from "../state.js";
import { loadMapLibre, escapeHtml } from "../utils.js";

/** @type {'session' | 'darkmatter' | 'midnight' | 'void'} */
const GC_MAP_STYLE = "session";
const GC_MAP_ALLOWED = ["session", "darkmatter", "midnight", "void"];
const GC_MAP_STYLE_RESOLVED = GC_MAP_ALLOWED.includes(GC_MAP_STYLE) ? GC_MAP_STYLE : "session";

const GC_VECTOR_STYLES = {
  session: "https://tiles.openfreemap.org/styles/liberty",
  darkmatter: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  midnight: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  void: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const GC_STYLE_CLASSES = [
  "gc-map-style--session",
  "gc-map-style--darkmatter",
  "gc-map-style--midnight",
  "gc-map-style--void",
];

function stripGcMapStyleClasses(el) {
  GC_STYLE_CLASSES.forEach((c) => el.classList.remove(c));
}

function getVectorStyleUrl() {
  return GC_VECTOR_STYLES[GC_MAP_STYLE_RESOLVED] || GC_VECTOR_STYLES.session;
}

function mapZoomForStyle() {
  if (GC_MAP_STYLE_RESOLVED === "session") return 15.35;
  if (GC_MAP_STYLE_RESOLVED === "void") return 14.4;
  return 15;
}

function mapPitchAndBearing() {
  if (GC_MAP_STYLE_RESOLVED === "session") {
    return { pitch: 48, bearing: -20 };
  }
  return { pitch: 0, bearing: 0 };
}

function buildGcMapPinElement() {
  const wrap = document.createElement("div");
  wrap.className = "gc-map-marker-pin";
  wrap.innerHTML =
    '<div class="gc-map-marker-stack">' +
    '<span class="gc-map-marker-pulse" aria-hidden="true"></span>' +
    '<span class="gc-map-marker-pin-inner" aria-hidden="true"></span>' +
    "</div>";
  return wrap;
}

function popupHtml(label, lat, lon) {
  const raw = label != null && String(label).trim() !== "" ? String(label) : `${lat}, ${lon}`;
  return `<div class="gc-map-ml-popup-inner">${escapeHtml(raw).replace(/\n/g, "<br>")}</div>`;
}

function placeGcMapMarker(lat, lon, label) {
  if (!state.mapInstance || typeof maplibregl === "undefined") return;
  if (state.gcMapMarker) {
    try {
      state.gcMapMarker.remove();
    } catch (_) {}
    state.gcMapMarker = null;
  }
  const popup = new maplibregl.Popup({
    offset: 28,
    className: "gc-map-ml-popup",
    closeButton: true,
    maxWidth: "320px",
  }).setHTML(popupHtml(label, lat, lon));
  state.gcMapMarker = new maplibregl.Marker({ element: buildGcMapPinElement(), anchor: "bottom" })
    .setLngLat([lon, lat])
    .setPopup(popup)
    .addTo(state.mapInstance);
}

export function showLocationOnMap(container, lat, lon, label, ip) {
  const mapEl = container?.querySelector("#gc-map");
  const tipEl = container?.querySelector("#gc-map-ip-value");
  if (!mapEl) return;
  loadMapLibre(() => {
    if (typeof maplibregl === "undefined") return;
    const zoom = mapZoomForStyle();
    const { pitch, bearing } = mapPitchAndBearing();
    const styleUrl = getVectorStyleUrl();

    if (!state.mapInstance) {
      mapEl.classList.remove("gc-map-empty");
      mapEl.innerHTML = "";
      stripGcMapStyleClasses(mapEl);
      mapEl.classList.add(`gc-map-style--${GC_MAP_STYLE_RESOLVED}`);
      state.mapInstance = new maplibregl.Map({
        container: mapEl,
        style: styleUrl,
        center: [lon, lat],
        zoom,
        pitch,
        bearing,
        attributionControl: true,
        maxPitch: 85,
        antialias: true,
      });
      state.mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
      state.mapInstance.addControl(new maplibregl.FullscreenControl({ container: mapEl }), "top-right");
      state.mapInstance.once("load", () => {
        if (!state.mapInstance) return;
        placeGcMapMarker(lat, lon, label);
        try {
          state.mapInstance.resize();
        } catch (_) {}
      });
    } else {
      state.mapInstance.flyTo({
        center: [lon, lat],
        zoom,
        pitch,
        bearing,
        duration: 700,
        essential: true,
      });
      placeGcMapMarker(lat, lon, label);
    }

    requestAnimationFrame(() => {
      try {
        state.mapInstance?.resize();
      } catch (_) {}
    });

    if (tipEl) {
      tipEl.textContent = ip || "";
      const tooltipWrap = container?.querySelector("#gc-map-ip-tooltip");
      if (tooltipWrap) tooltipWrap.style.display = ip ? "block" : "none";
    }
  });
}

export function clearMap(container) {
  if (state.gcMapMarker) {
    try {
      state.gcMapMarker.remove();
    } catch (_) {}
    state.gcMapMarker = null;
  }
  if (state.mapInstance && container) {
    const mapEl = container.querySelector("#gc-map");
    if (mapEl) {
      try {
        state.mapInstance.remove();
      } catch (_) {}
      state.mapInstance = null;
      mapEl.innerHTML = '<span class="gc-map-placeholder">Выберите местоположение ниже или запустите сессию.</span>';
      mapEl.classList.add("gc-map-empty");
      stripGcMapStyleClasses(mapEl);
      const tooltipWrap = container.querySelector("#gc-map-ip-tooltip");
      if (tooltipWrap) tooltipWrap.style.display = "none";
    }
  }
}

export function initMap(container) {
  container?.querySelector("#gc-btn-map")?.addEventListener("click", () => clearMap(container));
}
