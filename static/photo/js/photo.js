/* ══════════════════════════════════════
   OSINT PANEL — COMPLETE CLIENT
   вынесено из HTML в отдельный файл
   ══════════════════════════════════════ */

const API = window.location.origin;

// Пока отключаем AI-обработку по блокам: используем офлайн-инструменты (EXIF/ExifTool, reverse links, etc.)
const AI_ENABLED = false;

const TOOLS = [
  {id:'analysis',   name:'AI-анализ',      desc:'Люди, объекты, контекст',     cat:'Анализ',        color:'var(--amber)'},
  {id:'deep',       name:'Глубокий анализ', desc:'Форензика, AI-генерация',     cat:'Анализ',        color:'var(--orange)'},
  {id:'face',       name:'Анализ лиц',      desc:'Возраст, пол, черты',         cat:'Анализ',        color:'var(--rose)'},
  {id:'threat',     name:'Угрозы',          desc:'Опасные объекты, приватность',cat:'Анализ',        color:'var(--red)'},
  {id:'inventory',  name:'Инвентаризация',  desc:'Все объекты на фото',         cat:'Анализ',        color:'var(--teal)'},

  {id:'geolocate',  name:'Геолокация',      desc:'Определение места',           cat:'Местоположение', color:'var(--rose)'},
  {id:'exif',       name:'EXIF / GPS',      desc:'Метаданные, координаты',       cat:'Местоположение', color:'var(--sky)'},
  {id:'architecture',name:'Архитектура',    desc:'Стиль, эпоха, регион',        cat:'Местоположение', color:'#a8a29e'},
  {id:'vegetation', name:'Растительность',  desc:'Растения, климат',            cat:'Местоположение', color:'var(--green)'},

  {id:'timestamp',  name:'Время съёмки',    desc:'Дата и время по признакам',    cat:'Время',         color:'var(--indigo)'},
  {id:'weather',    name:'Погода',          desc:'Условия, освещение, тени',     cat:'Время',         color:'var(--yellow)'},

  {id:'ocr',        name:'OCR / Текст',     desc:'Текст, email, телефоны',       cat:'Текст',         color:'var(--cyan)'},
  {id:'qr',         name:'QR / Штрихкоды',  desc:'Декодирование кодов',          cat:'Текст',         color:'var(--violet)'},
  {id:'brand',      name:'Бренды / Логотипы',desc:'Идентификация брендов',       cat:'Текст',         color:'var(--pink)'},

  {id:'vehicle',    name:'Транспорт',       desc:'Марка, модель, номер',         cat:'Транспорт',     color:'var(--sky)'},
  {id:'cultural',   name:'Культура / Язык', desc:'Язык, религия, символы',       cat:'Культура',      color:'var(--fuchsia)'},

  {id:'social',     name:'Соцсети',         desc:'Профили и аккаунты',           cat:'Поиск',         color:'var(--pink)'},
  {id:'reverse',    name:'Обратный поиск',  desc:'Google, Yandex, TinEye',       cat:'Поиск',         color:'var(--violet)'},
  {id:'websearch',  name:'Веб-поиск',       desc:'Поиск по ключевым словам',     cat:'Поиск',         color:'var(--emerald)'},
];

const CATEGORIES = [...new Set(TOOLS.map(t=>t.cat))];
const CAT_ICONS = {
  'Анализ':'<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  'Местоположение':'<svg viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  'Время':'<svg viewBox="0 0 24 24"><polyline points="12 6 12 12 16 14"/></svg>',
  'Текст':'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  'Транспорт':'<svg viewBox="0 0 24 24"><path d="M5 17h2m10 0h2M3 11l1.5-5h15L21 11M3 11h18M3 11v6h18v-6"/></svg>',
  'Культура':'<svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  'Поиск':'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
};

const VLM_EP = {
  analysis:'/api/analyze', ocr:'/api/ocr', geolocate:'/api/geolocate',
  social:'/api/social-search', deep:'/api/deep-analysis', face:'/api/face',
  vehicle:'/api/vehicle', qr:'/api/qr-barcode', weather:'/api/weather',
  brand:'/api/brand-logo', architecture:'/api/architecture', timestamp:'/api/timestamp',
  vegetation:'/api/vegetation', threat:'/api/threat', cultural:'/api/cultural',
  inventory:'/api/object-inventory',
};

// Офлайн эндпоинты (не зависят от AI_ENABLED)
const OFFLINE_EP = {
  ocr: '/api/ocr',
  qr: '/api/qr-barcode',
};

/* ── State ── */
let imgSrc = null, imgB64 = null, imgUrl = '', urlMode = false;
/** Имя загруженного файла — уходит в /api/exif как filename (как в онлайн EXIF). */
let uploadFileName = null;
let running = new Set(), doneSet = new Set(), errSet = new Set(), collapsedSet = new Set();
let results = {}, searchResults = [], reverseLinks = null;

// EXIF: расширенный режим (ExifTool); геокод адреса по GPS — всегда (Nominatim), отдельная кнопка не нужна
let exifAdvanced = true;
let exifShowAllTags = false;
let exiftoolFull = null; // { tag_count, record_truncated, record }
let exiftoolFullLoading = false;
let exiftoolFullErr = '';
let exiftoolFullQuery = '';

/** MapLibre: тот же стиль, что Grabcam session (OpenFreeMap Liberty + тёмный фильтр в CSS) */
let photoMapExif = null;
let photoMapGeo = null;
let photoMarkerExif = null;
let photoMarkerGeo = null;

const hasImg = () => !!(imgB64 || imgUrl);

function setUploadUrlMode(next, ev) {
  if (ev) ev.stopPropagation();
  urlMode = !!next;
  render();
}

function submitImageUrlFromInput() {
  const input = document.getElementById('urlInput');
  imgUrl = input ? input.value.trim() : '';
  imgSrc = imgUrl;
  imgB64 = null;
  uploadFileName = null;
  render();
  setTimeout(runAllParallel, 300);
}

function setExiftoolFullQuery(value) {
  exiftoolFullQuery = value || '';
  render();
}

function toggleExifAdvanced() {
  exifAdvanced = !exifAdvanced;
  rerunTool('exif');
}

function toggleExifShowAllTags() {
  exifShowAllTags = !exifShowAllTags;
  if (exifShowAllTags) ensureExiftoolFullLoaded();
  render();
}

function destroyPhotoLeafletMaps() {
  if (photoMarkerExif) {
    try { photoMarkerExif.remove(); } catch (_) {}
    photoMarkerExif = null;
  }
  if (photoMarkerGeo) {
    try { photoMarkerGeo.remove(); } catch (_) {}
    photoMarkerGeo = null;
  }
  if (photoMapExif) {
    try { photoMapExif.remove(); } catch (_) {}
    photoMapExif = null;
  }
  if (photoMapGeo) {
    try { photoMapGeo.remove(); } catch (_) {}
    photoMapGeo = null;
  }
}

const _maplibreWaiters = [];
let _maplibreInjecting = false;

function loadMapLibreForPhoto(cb) {
  if (typeof maplibregl !== 'undefined') {
    cb();
    return;
  }
  _maplibreWaiters.push(cb);
  if (_maplibreInjecting) return;
  _maplibreInjecting = true;
  if (!document.querySelector('link[href*="maplibre-gl"][rel="stylesheet"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  script.crossOrigin = 'anonymous';
  script.onload = () => {
    const q = _maplibreWaiters.splice(0);
    q.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    _maplibreInjecting = false;
  };
  document.head.appendChild(script);
}

/** Как в Grabcam: Liberty + затемнение канваса в photo.css */
const PHOTO_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function _photoMapPinEl() {
  const wrap = document.createElement('div');
  wrap.className = 'photo-map-pin';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML =
    '<span class="photo-map-pin-core"></span><span class="photo-map-pin-pulse"></span><span class="photo-map-pin-ring"></span>';
  return wrap;
}

function mountPhotoCyberMap(containerId, lat, lon, slot) {
  loadMapLibreForPhoto(() => {
    const el = document.getElementById(containerId);
    if (!el || typeof maplibregl === 'undefined') return;
    const prevMap = slot === 'geo' ? photoMapGeo : photoMapExif;
    const prevMarker = slot === 'geo' ? photoMarkerGeo : photoMarkerExif;
    if (prevMarker) {
      try { prevMarker.remove(); } catch (_) {}
    }
    if (prevMap) {
      try { prevMap.remove(); } catch (_) {}
    }
    if (slot === 'geo') {
      photoMapGeo = null;
      photoMarkerGeo = null;
    } else {
      photoMapExif = null;
      photoMarkerExif = null;
    }

    const map = new maplibregl.Map({
      container: el,
      style: PHOTO_MAP_STYLE_URL,
      center: [lon, lat],
      zoom: 15.35,
      pitch: 48,
      bearing: -20,
      attributionControl: true,
      maxPitch: 85,
      antialias: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.FullscreenControl({ container: el }), 'top-right');

    if (slot === 'geo') photoMapGeo = map;
    else photoMapExif = map;

    map.once('load', () => {
      const active = slot === 'geo' ? photoMapGeo : photoMapExif;
      if (active !== map) return;
      const marker = new maplibregl.Marker({ element: _photoMapPinEl(), anchor: 'center' })
        .setLngLat([lon, lat])
        .addTo(map);
      if (slot === 'geo') photoMarkerGeo = marker;
      else photoMarkerExif = marker;
      try { map.resize(); } catch (_) {}
    });

    requestAnimationFrame(() => {
      try { map.resize(); } catch (_) {}
    });
    setTimeout(() => {
      try { map.resize(); } catch (_) {}
    }, 280);
  });
}

function initPhotoCyberMaps() {
  const ex = results.exif;
  if (ex?.gps && typeof ex.gps.latitude === 'number' && typeof ex.gps.longitude === 'number') {
    mountPhotoCyberMap('photo-leaflet-exif', ex.gps.latitude, ex.gps.longitude, 'exif');
  }
  const gl = results.geolocate;
  const est = gl?.estimatedLocation;
  if (est && typeof est.latitude === 'number' && typeof est.longitude === 'number') {
    mountPhotoCyberMap('photo-leaflet-geo', est.latitude, est.longitude, 'geo');
  }
}

/* ── Icons (SVG strings) ── */
const IC = {
  camera:'<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  radar:'<svg viewBox="0 0 24 24"><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  user:'<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  alert:'<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  package:'<svg viewBox="0 0 24 24"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  nav:'<svg viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  info:'<svg viewBox="0 0 24 24"><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  building:'<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22V12h6v10M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01"/></svg>',
  tree:'<svg viewBox="0 0 24 24"><path d="M17 14l-5-5-5 5"/><path d="M17 8l-5-5-5 5"/><line x1="12" y1="22" x2="12" y2="9"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><polyline points="12 6 12 12 16 14"/></svg>',
  sun:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  scan:'<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  qr:'<svg viewBox="0 0 24 24"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="5" height="5" rx="1"/><rect x="20" y="14" width="2" height="2"/><rect x="14" y="20" width="2" height="2"/><rect x="20" y="20" width="2" height="2"/></svg>',
  tag:'<svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  car:'<svg viewBox="0 0 24 24"><path d="M5 17h2m10 0h2M3 11l1.5-5h15L21 11M3 11h18M3 11v6h18v-6"/></svg>',
  flag:'<svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  finger:'<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  globe:'<svg viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xcirc:'<svg viewBox="0 0 24 24"><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  loader:'<svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
  chevUp:'<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>',
  chevDown:'<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>',
  retry:'<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  play:'<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  ext:'<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  eye:'<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
};

const TOOL_ICONS = {
  analysis:IC.camera, deep:IC.radar, face:IC.user, threat:IC.alert, inventory:IC.package,
  geolocate:IC.nav, exif:IC.info, architecture:IC.building, vegetation:IC.tree,
  timestamp:IC.clock, weather:IC.sun,
  ocr:IC.scan, qr:IC.qr, brand:IC.tag,
  vehicle:IC.car, cultural:IC.flag,
  social:IC.share, reverse:IC.finger, websearch:IC.globe,
};

/* ── Helpers ── */
function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function _isHttpUrl(s) { try { const u = new URL(String(s)); return u.protocol === 'http:' || u.protocol === 'https:'; } catch(_) { return false; } }
async function copyTextToClipboard(text) {
  try { await navigator.clipboard.writeText(String(text || '')); }
  catch(e) { alert('Не удалось скопировать: ' + (e?.message || e)); }
}
function buildSearchLinks(query) {
  const q = encodeURIComponent(String(query || '').trim());
  return {
    google: `https://www.google.com/search?q=${q}`,
    yandex: `https://yandex.ru/search/?text=${q}`,
    bing: `https://www.bing.com/search?q=${q}`,
    ddg: `https://duckduckgo.com/?q=${q}`,
  };
}

function buildSmartWebQueries(analysisText) {
  const q = [];
  const push = (s) => {
    const t = (s == null ? '' : String(s)).trim();
    if (!t) return;
    if (t.length > 140) return;
    q.push(t);
  };

  // 1) Если есть анализ — как раньше (ключевые слова / первые строки)
  if (analysisText) {
    const m = String(analysisText).match(/##\s*Ключевые слова[\s\S]*?(?=\n##|\n$|$)/i);
    if (m) {
      m[0]
        .split('\n')
        .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter((l) => l && !l.startsWith('#'))
        .forEach((l) => l.split(/[,;]/).map((p) => p.trim()).filter(Boolean).forEach(push));
    }
    if (!q.length) {
      String(analysisText)
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .slice(0, 3)
        .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .forEach(push);
    }
  }

  // 2) EXIF: камера/модель/ПО
  const ex = results.exif || {};
  const make = ex?.camera?.Make ? String(ex.camera.Make).trim() : '';
  const model = ex?.camera?.Model ? String(ex.camera.Model).trim() : '';
  const soft = ex?.software?.Software ? String(ex.software.Software).trim() : '';
  if (make || model) push([make, model].filter(Boolean).join(' '));
  if (soft) push(`${soft} camera app`);

  // 3) Адрес из GPS (если есть)
  const addrName = ex?.gps?.display_name ? String(ex.gps.display_name).trim() : '';
  if (addrName) push(addrName);

  // 4) OCR: emails/phones + короткие адреса
  const ocr = results.ocr || {};
  if (Array.isArray(ocr.emails) && ocr.emails[0]) push(String(ocr.emails[0]));
  if (Array.isArray(ocr.phones) && ocr.phones[0]) push(String(ocr.phones[0]));
  if (Array.isArray(ocr.urls) && ocr.urls[0]) push(String(ocr.urls[0]));
  if (Array.isArray(ocr.addresses) && ocr.addresses[0]) push(String(ocr.addresses[0]).slice(0, 90));

  // 5) Геолокация: город/регион + landmark
  const gl = results.geolocate || {};
  const est = gl?.estimatedLocation || null;
  if (est && (est.city || est.region || est.country)) {
    push([est.city, est.region, est.country].filter(Boolean).join(', '));
  }
  if (Array.isArray(gl.landmarks) && gl.landmarks[0]) push(String(gl.landmarks[0]));

  // финальный fallback
  if (!q.length) push('OSINT photo analysis');

  return [...new Set(q)].slice(0, 6);
}
function confBadge(level) {
  const l=String(level||'').toLowerCase();
  const c=l.includes('высок')?'conf-high':l.includes('средн')?'conf-mid':'conf-low';
  return `<span class="conf-badge ${c}">${esc(level)}</span>`;
}

/* ══════════════════════════════════════
   TOOL RUNNERS
   ══════════════════════════════════════ */
function imgPayload() {
  return { imageBase64: imgB64 || undefined, imageUrl: imgUrl || undefined };
}

async function runVlmTool(id, endpoint) {
  running.add(id); render();
  try {
    if (!AI_ENABLED) throw new Error('AI отключён (пока используем офлайн-инструменты).');
    const r = await fetch(API+endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(imgPayload()) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error||'Ошибка сервера');
    results[id] = d; running.delete(id); doneSet.add(id);
  } catch(e) {
    results[id] = {error:e.message}; running.delete(id); errSet.add(id);
  }
  render();
  return results[id];
}

async function runOfflineTool(id, endpoint, extraBody) {
  running.add(id); render();
  try {
    const body = Object.assign({}, imgPayload(), extraBody || {});
    const r = await fetch(API+endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error||'Ошибка сервера');
    results[id] = d; running.delete(id); doneSet.add(id);
  } catch(e) {
    results[id] = {error:e.message}; running.delete(id); errSet.add(id);
  }
  render();
  return results[id];
}

async function runExif() {
  running.add('exif'); render();
  if (!imgB64) {
    results.exif = {error:'EXIF доступен только при загрузке файла'};
    running.delete('exif'); errSet.add('exif'); render(); return results.exif;
  }
  try {
    const r = await fetch(API+'/api/exif', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        imageBase64:imgB64,
        exiftool: !!exifAdvanced,
        // geocode не передаём: на сервере по умолчанию автоматически при наличии GPS; geocode:false — только через API
        ...(uploadFileName ? { filename: uploadFileName } : {}),
      })
    });
    const d = await r.json();
    results.exif = d; running.delete('exif'); doneSet.add('exif');
  } catch(e) {
    results.exif = {error:e.message}; running.delete('exif'); errSet.add('exif');
  }
  render();
  return results.exif;
}

async function ensureExiftoolFullLoaded() {
  if (!imgB64) { exiftoolFullErr = 'Нужно загрузить файл (не URL).'; return null; }
  if (exiftoolFullLoading) return null;
  if (exiftoolFull && exiftoolFull.record) return exiftoolFull;
  exiftoolFullLoading = true;
  exiftoolFullErr = '';
  render();
  try {
    const r = await fetch(API + '/api/exif/exiftool/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: imgB64,
        exiftool: true,
        ...(uploadFileName ? { filename: uploadFileName } : {}),
      }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.error || 'Ошибка ExifTool JSON');
    exiftoolFull = { tag_count: d.tag_count, record_truncated: !!d.record_truncated, record: d.record || {} };
  } catch (e) {
    exiftoolFullErr = e.message || String(e);
    exiftoolFull = null;
  } finally {
    exiftoolFullLoading = false;
    render();
  }
  return exiftoolFull;
}

async function downloadExiftoolTxt() {
  if (!imgB64) { alert('Нужно загрузить файл (не URL).'); return; }
  try {
    const r = await fetch(API + '/api/exif/exiftool/txt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: imgB64,
        exiftool: true,
        ...(uploadFileName ? { filename: uploadFileName } : {}),
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || 'Ошибка скачивания TXT');
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (uploadFileName ? uploadFileName.replace(/\.[^.]+$/, '') + '.exiftool.txt' : 'exiftool.txt');
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Не удалось скачать: ' + (e.message || e));
  }
}

async function downloadExiftoolJson() {
  const d = await ensureExiftoolFullLoaded();
  if (!d || !d.record) { alert(exiftoolFullErr || 'ExifTool JSON недоступен'); return; }
  const payload = { tag_count: d.tag_count, record_truncated: !!d.record_truncated, record: d.record };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (uploadFileName ? uploadFileName.replace(/\.[^.]+$/, '') + '.exiftool.json' : 'exiftool.json');
  a.click();
  URL.revokeObjectURL(url);
}

function renderExiftoolFullBlock() {
  if (!exifShowAllTags) return '';
  const base = results.exif || {};
  const count = base.exiftool_tag_count ? String(base.exiftool_tag_count) : '';
  const status = exiftoolFullLoading ? '<span class="tag" style="border-color:rgba(245,158,11,0.25);color:var(--amber)">Загрузка…</span>' : '';
  const err = exiftoolFullErr ? `<p class="error-text">${esc(exiftoolFullErr)}</p>` : '';
  const rec = exiftoolFull && exiftoolFull.record ? exiftoolFull.record : null;
  const keys = rec ? Object.keys(rec) : [];
  const q = (exiftoolFullQuery || '').trim().toLowerCase();
  const filtered = rec
    ? keys.filter((k) => {
        if (!q) return true;
        const v = rec[k];
        let vv = '';
        try {
          if (typeof v === 'string') vv = v;
          else if (v && typeof v === 'object' && ('val' in v)) vv = String(v.val ?? '');
          else if (v && typeof v === 'object' && ('value' in v)) vv = String(v.value ?? '');
          else vv = JSON.stringify(v);
        } catch (_) {}
        return k.toLowerCase().includes(q) || vv.toLowerCase().includes(q);
      })
    : [];

  const warn = rec && exiftoolFull.record_truncated
    ? `<span class="tag" style="border-color:rgba(245,158,11,0.22);color:var(--amber)">Обрезано (слишком много данных)</span>`
    : '';

  const header = `
    <div class="section-label" style="color:var(--text3);margin-top:12px">Все теги ExifTool ${count ? `<span style="opacity:.7">(${count})</span>` : ''}</div>
    <div class="tag-list" style="margin-bottom:8px">
      ${status}${warn}
      <button class="upload-toggle" onclick="downloadExiftoolJson()">Скачать JSON</button>
      <button class="upload-toggle" onclick="downloadExiftoolTxt()">Скачать TXT</button>
    </div>
    <div class="exiftool-search">
      <input class="exiftool-search-input" placeholder="Поиск по тегам (например: GPS, Model, DateTime…)" value="${esc(exiftoolFullQuery||'')}"
        oninput="setExiftoolFullQuery(this.value)" />
      ${rec ? `<span class="exiftool-search-meta">${filtered.length}/${keys.length}</span>` : ''}
    </div>
  `;

  if (!rec) return header + err + `<p style="color:var(--text4);font-size:11px">Нажмите «Все теги ExifTool», чтобы загрузить.</p>`;

  const rows = filtered.slice(0, 250).map((k) => {
    const v = rec[k];
    let vv = '';
    try {
      if (typeof v === 'string') vv = v;
      else if (v && typeof v === 'object' && ('val' in v)) vv = String(v.val ?? '');
      else if (v && typeof v === 'object' && ('value' in v)) vv = String(v.value ?? '');
      else vv = JSON.stringify(v);
    } catch (_) {
      vv = String(v);
    }
    return `<div class="exiftool-row"><span class="exiftool-k">${esc(k)}</span><span class="exiftool-v">${esc(vv)}</span></div>`;
  }).join('');

  const more = filtered.length > 250 ? `<p style="color:var(--text4);font-size:10px;margin-top:6px">Показаны первые 250 совпадений. Уточните поиск, чтобы увидеть нужные теги.</p>` : '';
  return header + err + `<div class="exiftool-list scroll-y">${rows || `<p style="color:var(--text4);font-size:11px">Ничего не найдено.</p>`}</div>` + more;
}

async function runReverse() {
  running.add('reverse'); render();
  try {
    // Для reverse-search по URL нужен публичный http(s) URL.
    // Если загружен локальный файл (imgSrc=data:...), показываем страницы загрузки вручную.
    const url = (imgUrl || '').trim();
    if (!url || !_isHttpUrl(url)) {
      reverseLinks = {
        googleImages: "https://lens.google.com/",
        yandexImages: "https://yandex.ru/images/",
        bingVisual: "https://www.bing.com/visualsearch",
        tineye: "https://tineye.com/",
        baidu: "https://image.baidu.com/",
      };
      results.reverse = { success: true, mode: "manual_upload" };
      running.delete('reverse'); doneSet.add('reverse');
    } else {
      const r = await fetch(API+'/api/reverse-search', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({imageUrl:url}) });
      const d = await r.json();
      if (d.success) reverseLinks = d.links;
      results.reverse = d; running.delete('reverse'); doneSet.add('reverse');
    }
  } catch(e) {
    results.reverse = {error:e.message}; running.delete('reverse'); errSet.add('reverse');
  }
  render();
  return results.reverse;
}

async function runWebSearch(analysisText) {
  running.add('websearch'); render();
  const q = buildSmartWebQueries(analysisText);
  try {
    const r = await fetch(API+'/api/search', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({queries:q}) });
    const d = await r.json();
    searchResults = d.results||[];
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      // fallback: серверный поиск не настроен — даём ссылки на ручной поиск
      searchResults = q.map((qq) => ({ query: qq, results: [], links: buildSearchLinks(qq) }));
    } else {
      // добавим ссылки даже если сервер вернул результаты
      searchResults = searchResults.map((g) => ({ ...g, links: g.links || buildSearchLinks(g.query) }));
    }
    const count = searchResults.reduce((acc, g) => acc + (Array.isArray(g.results) ? g.results.length : 0), 0);
    results.websearch = {queries:q,count,mode:(count? 'server':'links')};
    running.delete('websearch'); doneSet.add('websearch');
  } catch(e) {
    results.websearch = {error:e.message}; running.delete('websearch'); errSet.add('websearch');
  }
  render();
  return results.websearch;
}

/* ══════════════════════════════════════
   RUN ALL PARALLEL
   ══════════════════════════════════════ */
async function runAllParallel() {
  if (!hasImg()) return;
  // Reset
  results={}; searchResults=[]; reverseLinks=null;
  running=new Set(); doneSet=new Set(); errSet=new Set(); collapsedSet=new Set();
  render();

  // Если AI выключен — запускаем только офлайн-инструменты
  const at = undefined;

  // 2) All others in parallel
  const promises = [];
  for (const t of TOOLS) {
    if (t.id==='exif') promises.push(runExif());
    else if (OFFLINE_EP[t.id]) promises.push(runOfflineTool(t.id, OFFLINE_EP[t.id]));
    else if (t.id==='reverse') promises.push(runReverse());
    else if (t.id==='websearch') promises.push(runWebSearch(at));
    else if (VLM_EP[t.id]) {
      // AI блоки пока не запускаем автоматически
      if (AI_ENABLED) promises.push(runVlmTool(t.id, VLM_EP[t.id]));
    }
  }
  await Promise.allSettled(promises);
}

/* ── Re-run single ── */
async function rerunTool(id) {
  doneSet.delete(id); errSet.delete(id); collapsedSet.delete(id);
  delete results[id]; render();

  if (id==='exif') await runExif();
  else if (OFFLINE_EP[id]) await runOfflineTool(id, OFFLINE_EP[id]);
  else if (id==='reverse') await runReverse();
  else if (id==='websearch') await runWebSearch(results.analysis?.analysis);
  else if (VLM_EP[id]) await runVlmTool(id, VLM_EP[id]);
}

/* ══════════════════════════════════════
   FILE HANDLING
   ══════════════════════════════════════ */
function onFile(f) {
  if (!f.type.startsWith('image/')) { alert('Только изображения'); return; }
  if (f.size > 10*1024*1024) { alert('Максимум 10 МБ'); return; }
  uploadFileName = f.name || null;
  const r = new FileReader();
  r.onload = e => { imgSrc=e.target.result; imgB64=e.target.result; imgUrl=''; render(); setTimeout(runAllParallel, 300); };
  r.readAsDataURL(f);
}

function clearAll() {
  imgSrc=null; imgB64=null; imgUrl='';
  uploadFileName=null;
  results={}; searchResults=[]; reverseLinks=null;
  running=new Set(); doneSet=new Set(); errSet=new Set(); collapsedSet=new Set();
  render();
}

/* ══════════════════════════════════════
   EXPORT
   ══════════════════════════════════════ */
async function exportReport() {
  try {
    const r = await fetch(API+'/api/export-report', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({results,searchResults,imageUrl:imgUrl}) });
    const d = await r.json();
    if (d.report) {
      const blob = new Blob([d.report],{type:'text/markdown'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='osint-report.md'; a.click();
      URL.revokeObjectURL(url);
    }
  } catch(e) { alert('Ошибка экспорта: '+e.message); }
}

/* ══════════════════════════════════════
   RENDER
   ══════════════════════════════════════ */
function render() {
  destroyPhotoLeafletMaps(); /* MapLibre + маркеры */
  renderHeader();
  renderUpload();
  renderMain();
  queueMicrotask(() => initPhotoCyberMaps());
}

function renderHeader() {
  const br = document.getElementById('badgeRunning');
  const bd = document.getElementById('badgeDone');
  const be = document.getElementById('btnExport');
  const progress = doneSet.size + errSet.size;

  if (running.size > 0) { br.style.display='inline-flex'; br.textContent=running.size+' активны'; }
  else br.style.display='none';

  if (doneSet.size > 0) { bd.style.display='inline-flex'; bd.textContent=doneSet.size+'/'+TOOLS.length; }
  else bd.style.display='none';

  be.style.display = progress > 0 ? 'inline-flex' : 'none';
}

function renderUpload() {
  const el = document.getElementById('uploadArea');
  const anyRunning = running.size > 0;
  const progress = doneSet.size + errSet.size;

  if (!imgSrc) {
    el.innerHTML = `
      <div class="upload-area" id="dropZone" onclick="document.getElementById('fileInput').click()">
        <input type="file" id="fileInput" accept="image/*" style="display:none" onchange="if(this.files[0])onFile(this.files[0])"/>
        <div class="upload-icon">${IC.upload}</div>
        ${urlMode ? `
          <div onclick="event.stopPropagation()">
            <p style="font-size:14px;color:var(--text2)">URL изображения</p>
            <div class="url-row">
              <input class="url-input" placeholder="https://example.com/photo.jpg" id="urlInput" value="${esc(imgUrl)}" onkeydown="if(event.key==='Enter') submitImageUrlFromInput()"/>
              <button class="btn btn-emerald" onclick="submitImageUrlFromInput()">OK</button>
            </div>
          </div>
        ` : `
          <p class="upload-title">Перетащите фото или нажмите для выбора</p>
          <p class="upload-sub">PNG, JPG, WebP · до 10 МБ · автозапуск всех инструментов</p>
        `}
        <div class="upload-toggles">
          <button class="upload-toggle ${!urlMode?'active':''}" onclick="setUploadUrlMode(false, event)">Файл</button>
          <button class="upload-toggle ${urlMode?'active':''}" onclick="setUploadUrlMode(true, event)">URL</button>
        </div>
      </div>`;
    // Drag events
    setTimeout(()=>{
      const dz = document.getElementById('dropZone');
      if (dz) {
        dz.ondragover = e=>{e.preventDefault();dz.classList.add('dragging')};
        dz.ondragleave = ()=>dz.classList.remove('dragging');
        dz.ondrop = e=>{e.preventDefault();dz.classList.remove('dragging');if(e.dataTransfer.files[0])onFile(e.dataTransfer.files[0])};
      }
    },0);
  } else {
    el.innerHTML = `
      <div class="preview">
        <div class="preview-img-wrap">
          <img src="${imgSrc}" class="preview-img" alt=""/>
          <button class="preview-close" onclick="clearAll()">✕</button>
        </div>
        <div class="preview-info">
          <p class="preview-title">Изображение загружено</p>
          <p class="preview-status">${anyRunning ? running.size+' инструментов выполняется...' : doneSet.size>0 ? doneSet.size+' из '+TOOLS.length+' завершено' : 'Запуск анализа...'}</p>
        </div>
        <div class="preview-actions">
          <button class="btn btn-emerald" onclick="runAllParallel()" ${anyRunning?'disabled':''}>
            ${anyRunning ? `<span class="spinner" style="display:inline-flex">${IC.loader}</span>` : IC.play}
            ${anyRunning ? 'Анализ...' : 'Запустить'}
          </button>
          <button class="btn" onclick="clearAll()">Сброс</button>
        </div>
      </div>
      ${anyRunning ? `
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" style="width:${(progress/TOOLS.length)*100}%"></div></div>
          <div class="progress-text">
            <span>${doneSet.size} готово${errSet.size>0?', '+errSet.size+' ошибок':''} · ${running.size} выполняется</span>
            <span>${Math.round((progress/TOOLS.length)*100)}%</span>
          </div>
        </div>
      ` : ''}`;
  }
}

function renderMain() {
  const el = document.getElementById('mainArea');

  if (!hasImg()) {
    // Overview
    el.innerHTML = `<div class="overview-grid">${CATEGORIES.map(cat=>`
      <div class="overview-card">
        <div class="overview-card-header">
          <span class="category-icon">${CAT_ICONS[cat]}</span>
          <span>${cat}</span>
          <span class="ov-count">${TOOLS.filter(t=>t.cat===cat).length}</span>
        </div>
        ${TOOLS.filter(t=>t.cat===cat).map(t=>`
          <div class="overview-item">
            <span class="oi-icon" style="color:${t.color}">${TOOL_ICONS[t.id]}</span>
            <div><p class="oi-name">${t.name}</p><p class="oi-desc">${t.desc}</p></div>
          </div>
        `).join('')}
      </div>
    `).join('')}</div>`;
    return;
  }

  // Results
  el.innerHTML = `<div>${CATEGORIES.map(cat=>{
    const catTools = TOOLS.filter(t=>t.cat===cat);
    const hasAny = catTools.some(t=>running.has(t.id)||doneSet.has(t.id)||errSet.has(t.id)||results[t.id]);
    if (!hasAny) return '';
    const catDone = catTools.filter(t=>doneSet.has(t.id)).length;
    const catRunning = catTools.filter(t=>running.has(t.id)).length;
    const catErrors = catTools.filter(t=>errSet.has(t.id)).length;

    return `
      <div class="category">
        <div class="category-header">
          <span class="category-icon">${CAT_ICONS[cat]}</span>
          <span class="category-name">${cat}</span>
          ${catRunning>0?`<span style="font-size:9px;color:var(--amber)" class="pulse">${catRunning} выполняется</span>`:''}
          ${catDone>0?`<span class="category-badge">${catDone}/${catTools.length}</span>`:''}
          ${catErrors>0?`<span style="font-size:8px;padding:0 4px;border-radius:9999px;border:1px solid rgba(239,68,68,0.2);color:var(--red)">${catErrors}</span>`:''}
        </div>
        <div class="tools-grid">
          ${catTools.map(t=>renderCard(t)).join('')}
        </div>
      </div>`;
  }).join('')}</div>`;
}

function renderCard(tool) {
  const isR = running.has(tool.id);
  const isD = doneSet.has(tool.id);
  const isE = errSet.has(tool.id);
  const isC = collapsedSet.has(tool.id);
  const d = results[tool.id];

  if (!isR && !isD && !isE && !d) return '';

  const cls = isR ? 'running' : isD ? 'done' : isE ? 'error' : 'idle';
  const wideCls = tool.id === 'exif' ? ' tool-card--wide' : '';
  const iconCls = isR ? 'running' : isD ? 'done' : isE ? 'error' : 'idle';

  let iconHtml;
  if (isR) iconHtml = `<span class="spinner" style="color:var(--amber)">${IC.loader}</span>`;
  else if (isD) iconHtml = `<span style="color:var(--emerald)">${IC.check}</span>`;
  else if (isE) iconHtml = `<span style="color:var(--red)">${IC.xcirc}</span>`;
  else iconHtml = `<span style="color:${tool.color}">${TOOL_ICONS[tool.id]}</span>`;

  let content = '';
  if (isD && !isC && d) content = renderContent(tool.id, d);

  let errorHtml = '';
  if (isE && d?.error && !isD) errorHtml = `<div style="padding:4px 12px 8px;border-top:1px solid rgba(255,255,255,0.04)"><p style="font-size:10px;color:var(--red)">${esc(d.error)}</p></div>`;

  return `
    <div class="tool-card ${cls}${wideCls}">
      <div class="tool-header">
        <div class="tool-icon ${iconCls}">${iconHtml}</div>
        <span class="tool-name">${tool.name}</span>
        ${isR ? '<span class="tool-status">анализ...</span>' : ''}
        <div class="tool-actions">
          ${isD ? `<button class="tool-btn" onclick="collapsedSet.${isC?'delete':'add'}('${tool.id}');render()">${isC?IC.chevDown:IC.chevUp}</button>` : ''}
          ${(isD||isE) ? `<button class="tool-btn" onclick="rerunTool('${tool.id}')" ${isR?'disabled':''}>${IC.retry}</button>` : ''}
        </div>
      </div>
      ${content}
      ${errorHtml}
    </div>`;
}

/* ══════════════════════════════════════
   RENDER CONTENT BY TOOL
   ══════════════════════════════════════ */
function renderContent(id, d) {
  let html = '<div class="tool-content" style="margin-top:0">';

  if (id==='analysis' && d.analysis) {
    html += `<div class="analysis-text scroll-y">${esc(String(d.analysis))}</div>`;
  }

  else if (id==='exif') {
    if (d.error) { html += `<p class="error-text">${esc(d.error)}</p>`; }
    else {
      const exif = d;
      html += `
        <div class="tag-list" style="margin-bottom:10px">
          <button class="upload-toggle ${exifAdvanced?'active':''}" onclick="toggleExifAdvanced()">ExifTool</button>
          <button class="upload-toggle" onclick="downloadCleanImage()">Сохранить без EXIF</button>
          <button class="upload-toggle ${exifShowAllTags?'active':''}" onclick="toggleExifShowAllTags()">Все теги</button>
        </div>
      `;

      if (Array.isArray(exif.privacy) && exif.privacy.length) {
        html += `<div class="section-label" style="color:var(--text3)">Приватность</div>`;
        html += `<div class="tag-list">${exif.privacy.map(x=>`<span class="tag" style="border-color:rgba(239,68,68,0.2);color:var(--red)">${esc(x)}</span>`).join('')}</div>`;
      }

      html += renderExifGpsMapBlock(exif);

      html += `<div class="exif-side-by-side">`;
      html += `<div class="exif-col">`;
      html += `<div class="section-label" style="color:var(--text3);margin-top:10px">Камера</div>`;
      html += `<div class="exif-meta-box">`;
      html += metaRowsKeys(exif.camera, ['Make', 'Model']);

      const dt = primaryExifDateTime(exif.dates);
      html += `<div class="section-label" style="color:var(--text3);margin-top:10px">Дата и время</div>`;
      html += dt
        ? `<div class="meta-row"><span class="meta-key">Снято (EXIF)</span><span class="meta-val">${esc(dt)}</span></div>`
        : '<p style="color:var(--text4);font-size:11px">—</p>';

      if (exif.shooting && Object.keys(exif.shooting).length) {
        html += `<div class="section-label" style="color:var(--text3);margin-top:10px">Параметры съёмки</div>`;
        html += Object.entries(exif.shooting).map(([k, v]) => {
          const lab = SHOOT_LABEL[k] || k;
          return `<div class="meta-row"><span class="meta-key">${esc(lab)}</span><span class="meta-val">${esc(formatShootVal(v))}</span></div>`;
        }).join('');
      }

      html += `<div class="section-label" style="color:var(--text3);margin-top:10px">ПО</div>`;
      html += metaRowsKeys(exif.software, ['Software']);

      const copy = exif.software;
      if (copy && (copy.Artist || copy.Copyright)) {
        html += `<div class="section-label" style="color:var(--text3);margin-top:10px">Авторство</div>`;
        html += metaRowsKeys(copy, ['Artist', 'Copyright']);
      }

      html += `</div>`; /* exif-meta-box */
      html += `</div>`; /* exif-col */
      html += `<div class="exif-col">`;
      html += renderExifAddressBlock(exif);
      html += `</div>`;
      html += `</div>`;

      html += renderExifFileBlock(exif);

      html += renderExiftoolFullBlock();

      if (exif.exiftool && (exif.exiftool.error || exif.exiftool.skipped)) {
        html += `<div class="section-label" style="color:var(--text3);margin-top:10px">ExifTool</div>`;
        html += `<p class="error-text">${esc(exif.exiftool.error || 'Расширенный разбор недоступен')}</p>`;
      }
    }
  }

  else if (id==='ocr') {
    const ocr = d;
    if (!ocr?.fullText && !ocr?.emails?.length) html += `<p style="color:var(--text4)">Текст не найден</p>`;
    else {
      if (ocr.fullText) html += `<div class="text-box"><div class="tb-label">Распознанный текст</div><div class="tb-text scroll-y" style="max-height:120px">${esc(ocr.fullText)}</div></div>`;
      const items = [
        {l:'Email',a:ocr.emails,c:'var(--cyan)'},{l:'URL',a:ocr.urls,c:'var(--violet)'},
        {l:'Тел.',a:ocr.phones,c:'var(--green)'},{l:'Адреса',a:ocr.addresses,c:'var(--amber)'},
        {l:'Имена',a:ocr.names,c:'var(--pink)'},{l:'Бренды',a:ocr.brands,c:'var(--orange)'}
      ].filter(x=>x.a?.length>0);
      if (items.length) {
        html += `<div class="ocr-grid">${items.map(x=>`
          <div class="ocr-item">
            <div class="ocr-label"><span style="color:${x.c}">●</span>${esc(x.l)}</div>
            ${x.a.map(v=>`<p>${esc(v)}</p>`).join('')}
          </div>`).join('')}</div>`;
      }
    }
  }

  else if (id==='qr') {
    const qr = d || {};
    if (qr?.error) html += `<p class="error-text">${esc(qr.error)}</p>`;
    else {
      const items = Array.isArray(qr.items) ? qr.items : [];
      const decoded = Array.isArray(qr.decoded) ? qr.decoded : [];
      const count = typeof qr.count === 'number' ? qr.count : (items.length || decoded.length || 0);
      const dur = qr?.stats?.duration_ms != null ? Number(qr.stats.duration_ms) : null;
      const httpUrlCount = qr?.stats?.http_url_count != null ? Number(qr.stats.http_url_count) : null;
      const uniqUrls = qr?.stats?.unique_urls != null ? Number(qr.stats.unique_urls) : null;
      const uniqHosts = qr?.stats?.unique_hosts != null ? Number(qr.stats.unique_hosts) : null;

      // Человеческое резюме
      const sec = dur != null && !Number.isNaN(dur) ? Math.max(0, dur) / 1000 : null;
      const timeStr = sec == null ? '—' : (sec < 1 ? `${Math.round(sec * 1000)} мс` : `${sec.toFixed(sec < 10 ? 1 : 0)} сек`);
      const linksStr =
        httpUrlCount != null
          ? (httpUrlCount > 0 ? `обнаружены (${httpUrlCount})` : 'не обнаружены')
          : '—';
      const sitesStr =
        uniqHosts != null
          ? (uniqHosts > 0 ? `${uniqHosts}` : '0')
          : '—';
      html += `<div class="neutral-box" style="margin-top:0">
        <div class="neutral-box-title">Результат</div>
        <div class="neutral-box-text">
          QR/штрихкоды: <b>${count ? `${count} найдено` : 'ничего не найдено'}</b>.<br>
          Ссылки (URL): <b>${esc(linksStr)}</b>.<br>
          Сайты: <b>${esc(String(sitesStr))}</b>.<br>
          Время работы: <b>${esc(timeStr)}</b>.
        </div>
      </div>`;

      if (!count) {
        // ничего не найдено — достаточно резюме
      } else {
        html += `<div class="tag-list" style="margin-bottom:8px">
          <span class="tag" style="border-color:rgba(16,185,129,0.2);color:var(--emerald)">${count} найдено</span>
          ${dur!=null ? `<span class="tag" style="border-color:rgba(255,255,255,0.08);color:var(--text4)">${Math.round(dur)} ms</span>` : ''}
        </div>`;

        const rows = items.length ? items : decoded.map(s => ({ type: 'QR', data: s }));
        html += `<div class="qr-list">` + rows.map((it, idx) => {
          const t = (it && it.type) ? String(it.type) : 'CODE';
          const data = (it && (it.data != null ? it.data : it.text)) != null ? String(it.data != null ? it.data : it.text) : '';
          const openBtn = _isHttpUrl(data)
            ? `<a class="qr-btn" href="${esc(data)}" target="_blank" rel="noopener">Открыть</a>`
            : '';
          return `<div class="qr-item">
            <div class="qr-head">
              <span class="qr-type">${esc(t || 'CODE')}</span>
              <span class="qr-idx">#${idx + 1}</span>
            </div>
            <div class="qr-data">${esc(data || '—')}</div>
            <div class="qr-actions">
              <button class="qr-btn" type="button" onclick="copyTextToClipboard(${JSON.stringify(data)})">Копировать</button>
              ${openBtn}
            </div>
          </div>`;
        }).join('') + `</div>`;
      }

      // Статистику не показываем: она уже отражена в человеческом резюме
    }
  }

  else if (id==='geolocate') {
    const geo = d;
    if (geo?.estimatedLocation) {
      const el2 = geo.estimatedLocation;
      html += `<div class="geo-box">
        <div class="geo-label"><span>${esc(el2.country)}, ${esc(el2.region)}, ${esc(el2.city)}</span> ${confBadge(el2.confidence)}</div>
        <div class="gps-coords">${el2.latitude.toFixed(4)}, ${el2.longitude.toFixed(4)}</div>
        <div class="gps-map photo-cyber-map photo-map--geo" aria-label="Карта">
          <div id="photo-leaflet-geo" class="photo-leaflet-root"></div>
        </div>
      </div>`;
      if (geo.landmarks?.length) {
        html += `<div class="tag-list">${geo.landmarks.map(l=>`<span class="tag" style="border-color:rgba(244,63,94,0.2);color:var(--rose)">${esc(l)}</span>`).join('')}</div>`;
      }
    }
  }

  else if (id==='social') {
    const s = d;
    if (s?.identifiedPersons?.length) {
      html += s.identifiedPersons.map(p=>`
        <div class="social-box">
          <p>${esc(p.description)}</p>
          <div class="platform-list">${(p.possiblePlatforms||[]).map(pl=>`<span class="platform-tag">${esc(pl)}</span>`).join('')}</div>
        </div>`).join('');
    }
    if (s?.hashtags?.length) {
      html += `<div class="tag-list">${s.hashtags.map(h=>`<span class="tag" style="border-color:rgba(236,72,153,0.2);color:var(--pink)">${esc(h)}</span>`).join('')}</div>`;
    }
  }

  else if (id==='deep') {
    const dp = d;
    if (dp?.forensicAnalysis) {
      html += `<div class="section-label" style="color:var(--orange)">${IC.eye} Форензика</div>`;
      html += kvGrid(dp.forensicAnalysis);
    }
    if (dp?.threatAssessment) {
      html += `<div class="section-label" style="color:var(--red)">${IC.alert} Угрозы</div>`;
      html += kvGrid(dp.threatAssessment);
    }
    if (dp?.investigationLeads?.length) {
      html += dp.investigationLeads.map(l=>`
        <div class="lead-box">
          <span class="lead-title">${esc(l.lead)}</span> ${confBadge(l.priority)}
          <div class="lead-text">${esc(l.nextSteps)}</div>
        </div>`).join('');
    }
  }

  else if (id==='reverse' && reverseLinks) {
    const names = {googleImages:'Google Lens',yandexImages:'Яндекс',bingVisual:'Bing',tineye:'TinEye',baidu:'Baidu'};
    const linksArr = Object.entries(reverseLinks).map(([e,u]) => `${names[e]||e}: ${u}`);
    const copyAllBtn = `<button class="upload-toggle" type="button" onclick="copyTextToClipboard(${JSON.stringify(linksArr.join('\\n'))})">Скопировать все ссылки</button>`;
    const imgHint = imgUrl
      ? `<button class="upload-toggle" type="button" onclick="copyTextToClipboard(${JSON.stringify(imgUrl)})">Копировать URL фото</button><a class="upload-toggle" href="${esc(imgUrl)}" target="_blank" rel="noopener">Открыть фото</a>`
      : `<span class="tag" style="border-color:rgba(255,255,255,0.08);color:var(--text4)">Файл без URL: сервисы откроются, загрузите фото вручную</span>`;
    html += `<div class="tag-list" style="margin-bottom:8px">${copyAllBtn}${imgHint}</div>`;
    html += `<div class="reverse-grid">${Object.entries(reverseLinks).map(([e,u])=>`
      <a class="reverse-link" href="${u}" target="_blank">${IC.search} <span>${names[e]||e}</span></a>`).join('')}</div>`;
  }

  else if (id==='websearch') {
    const ws = results.websearch || {};
    const groups = Array.isArray(searchResults) ? searchResults : [];
    const hasAny = Array.isArray(ws.queries) && ws.queries.length;
    if (!hasAny) {
      html += `<p style="color:var(--text4);font-size:11px">Нет запросов для поиска.</p>`;
    } else {
      html += `<div class="tag-list" style="margin-bottom:10px">
        <span class="tag" style="border-color:rgba(255,255,255,0.08);color:var(--text4)">Запросов: ${ws.queries.length}</span>
        <button class="upload-toggle" type="button" onclick="copyTextToClipboard(${JSON.stringify((ws.queries||[]).join('\\n'))})">Скопировать все запросы</button>
      </div>`;
      html += groups.map(g=> {
        const links = g.links || buildSearchLinks(g.query);
        const res = Array.isArray(g.results) ? g.results : [];
        return `
          <div class="search-group">
            <div class="search-query">${IC.search} <span>${esc(g.query)}</span> <span class="tag">${res.length}</span></div>
            <div class="tag-list" style="margin:6px 0 8px">
              <button class="upload-toggle" type="button" onclick="copyTextToClipboard(${JSON.stringify(String(g.query||''))})">Копировать запрос</button>
              <a class="upload-toggle" href="${esc(links.google)}" target="_blank" rel="noopener">Google</a>
              <a class="upload-toggle" href="${esc(links.yandex)}" target="_blank" rel="noopener">Яндекс</a>
              <a class="upload-toggle" href="${esc(links.bing)}" target="_blank" rel="noopener">Bing</a>
              <a class="upload-toggle" href="${esc(links.ddg)}" target="_blank" rel="noopener">DDG</a>
            </div>
            ${res.length ? res.slice(0,3).map(r=>`
              <a class="search-result" href="${esc(r.url||'')}" target="_blank" rel="noopener">
                <div class="sr-title">${esc(r.title || r.name || '')}</div>
                <div class="sr-meta">${esc(r.host_name||'')}${r.date?' · '+r.date:''}</div>
                <div class="sr-snippet">${esc(r.snippet||'')}</div>
              </a>`).join('') : `<p style="color:var(--text4);font-size:10px;margin-top:4px">Серверный поиск не настроен — используйте кнопки выше.</p>`}
          </div>`;
      }).join('');
    }
  }

  // Generic VLM tools
  else if (['face','vehicle','weather','brand','architecture','timestamp','vegetation','threat','cultural','inventory'].includes(id)) {
    if (d?.error) html += `<p class="error-text">${esc(d.error)}</p>`;
    else {
      const exc = ['success','error'];
      const keys = Object.keys(d||{}).filter(k=>!exc.includes(k)&&d[k]!=null);
      html += `<div class="generic-list">`;
      for (const key of keys) {
        const val = d[key];
        if (typeof val === 'string') { html += `<p style="margin-top:6px">${esc(val)}</p>`; }
        else if (Array.isArray(val) && val.length > 0) {
          if (typeof val[0] === 'string') {
            html += `<div class="tag-list">${val.map(v=>`<span class="tag">${esc(v)}</span>`).join('')}</div>`;
          } else {
            html += `<div class="section-label" style="color:var(--text3)">${esc(key)} (${val.length})</div>`;
            html += `<div class="scroll-y">${val.map(item=>`
              <div class="generic-item">${Object.entries(item).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`
                <div class="generic-kv"><span class="gk-key">${esc(k)}:</span><span class="gk-val">${esc(String(v))}</span></div>`).join('')}
              </div>`).join('')}</div>`;
          }
        }
        else if (typeof val === 'object' && val !== null) {
          html += `<div class="section-label" style="color:var(--text3)">${esc(key)}</div>`;
          html += kvGrid(val);
        }
      }
      html += `</div>`;
    }
  }

  html += '</div>';
  return html;
}

function metaRows(data) {
  const entries = Object.entries(data).filter(([,v])=>v!=null);
  if (!entries.length) return '<p style="color:var(--text4);font-size:11px">—</p>';
  return entries.map(([k,v])=>`<div class="meta-row"><span class="meta-key">${esc(k)}</span><span class="meta-val">${esc(String(v))}</span></div>`).join('');
}

/** Только выбранные ключи EXIF с понятными подписями (без сырья ExifTool). */
const EXIF_LABEL = {
  Make: 'Производитель',
  Model: 'Модель',
  Software: 'Программа',
  Artist: 'Автор',
  Copyright: 'Правообладатель',
};

const SHOOT_LABEL = {
  ISOSpeedRatings: 'ISO',
  PhotographicSensitivity: 'ISO (чувствительность)',
  ExposureTime: 'Выдержка',
  FNumber: 'Диафрагма',
  FocalLength: 'Фокус',
  FocalLengthIn35mmFilm: 'Экв. 35 мм',
  Flash: 'Вспышка',
  WhiteBalance: 'Баланс белого',
  MeteringMode: 'Замер',
  ExposureProgram: 'Программа экспозиции',
  Orientation: 'Ориентация',
};

function formatShootVal(v) {
  if (v == null) return '';
  if (typeof v === 'object' && v !== null && 'numerator' in v && 'denominator' in v) {
    const n = v.numerator;
    const d = v.denominator;
    if (d === 1) return String(n);
    return `${n}/${d}`;
  }
  if (Array.isArray(v)) return v.map(formatShootVal).join(', ');
  return String(v);
}

function metaRowsKeys(data, keys) {
  if (!data) return '<p style="color:var(--text4);font-size:11px">—</p>';
  const rows = [];
  for (const k of keys) {
    const v = data[k];
    if (v == null || String(v).trim() === '') continue;
    const lab = EXIF_LABEL[k] || k;
    rows.push(`<div class="meta-row"><span class="meta-key">${esc(lab)}</span><span class="meta-val">${esc(String(v))}</span></div>`);
  }
  if (!rows.length) return '<p style="color:var(--text4);font-size:11px">—</p>';
  return rows.join('');
}

function primaryExifDateTime(dates) {
  if (!dates) return null;
  const v = dates.DateTimeOriginal || dates.DateTime || dates.DateTimeDigitized;
  return v != null && String(v).trim() !== '' ? String(v).trim() : null;
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (bytes == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function exifGpsCoordsOk(exif) {
  const g = exif && exif.gps;
  return (
    g &&
    typeof g.latitude === 'number' &&
    typeof g.longitude === 'number' &&
    !Number.isNaN(g.latitude) &&
    !Number.isNaN(g.longitude)
  );
}

/** Карта, WGS84 и ссылки — сразу после приватности (как раньше по смыслу). */
function renderExifGpsMapBlock(exif) {
  if (!exifGpsCoordsOk(exif)) {
    return `<div class="no-gps gps-map-slot">${IC.xcirc} GPS в метаданных не найден</div>`;
  }
  const g = exif.gps;
  const lat6 = g.latitude.toFixed(6);
  const lon6 = g.longitude.toFixed(6);
  return `<div class="gps-box gps-box-map-slot">
          <div class="gps-coord-row"><span class="gps-coord-key">WGS84</span><span class="gps-coord-val">${lat6}, ${lon6}</span></div>
          <div class="gps-links">
            <a href="${g.googleMapsUrl}" target="_blank" rel="noopener">${IC.ext} Google</a>
            <a href="${g.yandexMapsUrl}" target="_blank" rel="noopener">${IC.ext} Яндекс</a>
            <a href="${g.openStreetMapUrl}" target="_blank" rel="noopener">${IC.ext} OSM</a>
          </div>
          <div class="gps-map photo-cyber-map photo-map--exif" aria-label="Карта">
            <div id="photo-leaflet-exif" class="photo-leaflet-root"></div>
          </div>
        </div>`;
}

function _addrPick(addr, ...keys) {
  if (!addr || typeof addr !== 'object') return '';
  for (const k of keys) {
    const v = addr[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function _addrDlRows(pairs) {
  return pairs
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<div class="exif-addr-row"><dt>${esc(k)}:</dt><dd>${esc(v)}</dd></div>`,
    )
    .join('');
}

/** Только адрес (геокод) — структура из Nominatim `address`, иначе одна строка `display_name`. */
function renderExifAddressBlock(exif) {
  if (!exifGpsCoordsOk(exif)) return '';
  const g = exif.gps;
  const disp = String(g.display_name || '').trim();
  const addr = g.address && typeof g.address === 'object' ? g.address : null;

  let inner = '';
  if (addr) {
    const geoPairs = [];
    const country = _addrPick(addr, 'country');
    const ccRaw = _addrPick(addr, 'country_code');
    const cc = ccRaw ? ccRaw.toUpperCase() : '';
    if (country) geoPairs.push(['Страна', cc ? `${country} (${cc})` : country]);

    const fed = _addrPick(addr, 'state', 'region');
    if (fed) geoPairs.push(['Федеральный округ', fed]);

    const city = _addrPick(
      addr,
      'city',
      'town',
      'village',
      'municipality',
      'county',
      'state_district',
    );
    if (city) geoPairs.push(['Субъект (город)', city]);

    const district = _addrPick(
      addr,
      'suburb',
      'city_district',
      'quarter',
      'neighbourhood',
      'district',
      'borough',
    );
    if (district) geoPairs.push(['Район', district]);

    const street = _addrPick(addr, 'road', 'pedestrian', 'residential', 'path', 'footway');
    if (street) geoPairs.push(['Улица', street]);

    const postPairs = [];
    const pc = _addrPick(addr, 'postcode');
    if (pc) postPairs.push(['Индекс', pc]);
    const hn = _addrPick(addr, 'house_number');
    if (hn) postPairs.push(['Дом', hn]);

    const geoBlock =
      geoPairs.length > 0
        ? `<div class="exif-addr-group-title">🌍 Географическая иерархия</div><dl class="exif-addr-dl">${_addrDlRows(
            geoPairs,
          )}</dl>`
        : '';
    const postBlock =
      postPairs.length > 0
        ? `<div class="exif-addr-group-title exif-addr-post-title">📮 Почтовые данные</div><dl class="exif-addr-dl">${_addrDlRows(
            postPairs,
          )}</dl>`
        : '';

    inner = geoBlock + postBlock;
    if (!inner && disp) inner = `<div class="gps-address-text">${esc(disp)}</div>`;
  } else if (disp) {
    inner = `<div class="gps-address-text">${esc(disp)}</div>`;
  }

  if (!inner) return '';

  return `<div class="exif-address-section">
    <div class="section-label" style="color:var(--text3)">Адрес</div>
    <div class="exif-address-box">${inner}</div>
  </div>`;
}

/** То, что онлайн-сервисы показывают в блоке «файл / хеши» — сервер уже отдаёт в meta/hashes. */
function renderExifFileBlock(exif) {
  const m = exif.meta;
  const hs = exif.hashes;
  const fs = exif.file_stats;
  const hasAny =
    m ||
    hs ||
    exif.perceptual ||
    (fs && fs.entropy_bits_per_byte != null) ||
    exif.exiftool_tag_count != null;
  if (!hasAny) return '';

  const rows = [];
  if (m) {
    if (m.filename) rows.push(['Имя файла', m.filename]);
    if (m.format) rows.push(['Формат', m.format]);
    if (m.mime_detected) rows.push(['MIME (сигнатура)', m.mime_detected]);
    if (m.bytes != null) rows.push(['Размер', formatFileSize(m.bytes)]);
    if (m.width != null && m.height != null) rows.push(['Разрешение', `${m.width}×${m.height}`]);
    if (m.megapixels != null) rows.push(['Мегапиксели', String(m.megapixels)]);
    if (m.mode) rows.push(['Режим', m.mode]);
    if (m.has_icc_profile === true || m.has_icc_profile === false) {
      rows.push(['ICC-профиль', m.has_icc_profile ? 'да' : 'нет']);
    }
  }
  if (hs) {
    if (hs.md5) rows.push(['MD5', hs.md5]);
    if (hs.sha1) rows.push(['SHA-1', hs.sha1]);
    if (hs.sha256) rows.push(['SHA-256', hs.sha256]);
    if (hs.crc32) rows.push(['CRC32', hs.crc32]);
  }
  if (exif.perceptual) {
    const p = exif.perceptual;
    if (p.ahash) rows.push(['aHash', p.ahash]);
    if (p.dhash) rows.push(['dHash', p.dhash]);
  }
  if (fs && fs.entropy_bits_per_byte != null) {
    rows.push(['Энтропия (бит/байт)', String(fs.entropy_bits_per_byte)]);
  }
  if (exif.exiftool_tag_count != null) {
    rows.push(['Записей в ExifTool', String(exif.exiftool_tag_count)]);
  }

  let out = '<div class="section-label exif-file-section-label" style="color:var(--text3)">Файл и контрольные суммы</div>';
  out += '<div class="exif-file-block">';
  out += rows.map(([k, v]) => `<div class="meta-row"><span class="meta-key">${esc(k)}</span><span class="meta-val exif-mono">${esc(String(v))}</span></div>`).join('');
  if (m && m.header_hex) {
    const hx = String(m.header_hex).replace(/\s/g, '');
    const pairs = hx.match(/.{1,2}/g);
    const spaced = pairs ? pairs.join(' ') : esc(hx);
    out += `<div class="exif-hex-block"><span class="meta-key">Первые 64 байта (hex)</span><pre class="exif-hex-pre">${esc(spaced)}</pre></div>`;
  }
  if (m && !m.filename) {
    out += '<p class="exif-file-note">Имя файла появится, если выбрать изображение с диска (не URL).</p>';
  }
  if (exif.exiftool_tag_count != null) {
    out += `
      <div class="tag-list" style="margin-top:8px">
        <button class="upload-toggle ${exifShowAllTags?'active':''}" onclick="toggleExifShowAllTags()">Все теги ExifTool</button>
        <button class="upload-toggle" onclick="downloadExiftoolJson()">Скачать JSON</button>
        <button class="upload-toggle" onclick="downloadExiftoolTxt()">Скачать TXT</button>
      </div>
    `;
  }
  out += '</div>';
  return out;
}

function kvGrid(data) {
  const entries = Object.entries(data);
  if (!entries.length) return '';
  return `<div class="kv-grid">${entries.map(([k,v])=>`
    <div class="kv-item"><div class="kv-key">${esc(k.replace(/([A-Z])/g,' $1').trim())}</div><div class="kv-val">${esc(String(v))}</div></div>`).join('')}</div>`;
}

/* ══════════════════════════════════════
   INIT
   ══════════════════════════════════════ */
function wireUserMenu() {
  const btnUser = document.getElementById('btn-user-menu');
  const userMenu = document.getElementById('user-menu');
  if (!btnUser || !userMenu) return;
  btnUser.addEventListener('click', () => {
    const open = btnUser.getAttribute('aria-expanded') === 'true';
    btnUser.setAttribute('aria-expanded', String(!open));
    userMenu.hidden = open;
  });
  document.addEventListener('click', (e) => {
    if (!btnUser.contains(e.target) && !userMenu.contains(e.target)) {
      btnUser.setAttribute('aria-expanded', 'false');
      userMenu.hidden = true;
    }
  });
}

wireUserMenu();
render();

async function downloadCleanImage() {
  if (!imgB64) { alert('Нужно загрузить файл (не URL).'); return; }
  try {
    const r = await fetch(API+'/api/exif/strip', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imageBase64: imgB64})
    });
    if (!r.ok) {
      let msg = 'Ошибка';
      try { const j = await r.json(); msg = j.error || msg; } catch(e) {}
      throw new Error(msg);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (blob.type==='image/jpeg') ? 'clean.jpg' : 'clean.png';
    a.click();
    URL.revokeObjectURL(url);
  } catch(e) {
    alert('Не удалось удалить метаданные: ' + (e.message || e));
  }
}

// Делает функции доступными для inline onclick в HTML
window.exportReport = exportReport;
window.runAllParallel = runAllParallel;
window.clearAll = clearAll;
window.rerunTool = rerunTool;
window.onFile = onFile;
window.collapsedSet = collapsedSet;
window.render = render;
window.downloadCleanImage = downloadCleanImage;
window.setUploadUrlMode = setUploadUrlMode;
window.submitImageUrlFromInput = submitImageUrlFromInput;
window.setExiftoolFullQuery = setExiftoolFullQuery;
window.toggleExifAdvanced = toggleExifAdvanced;
window.toggleExifShowAllTags = toggleExifShowAllTags;

