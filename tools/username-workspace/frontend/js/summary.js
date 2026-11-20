export function setSummary({
  uniqueUrls = 0,
  uniqueDomains = 0,
  scannedCount = 0,
  selectedTotal = 4,
  wallSeconds = 0,
} = {}) {
  const bar = document.getElementById("summaryBar");
  if (bar) bar.style.display = "flex";
  const uEl = document.getElementById("summaryUniqueUrls");
  const dEl = document.getElementById("summaryUniqueDomains");
  const scannedEl = document.getElementById("scannedCount");
  const totalEl = document.getElementById("runSelectedTotal");
  const wallEl = document.getElementById("wallTimeSec");
  if (uEl) uEl.textContent = String(Math.max(0, Math.floor(uniqueUrls)));
  if (dEl) dEl.textContent = String(Math.max(0, Math.floor(uniqueDomains)));
  if (scannedEl) scannedEl.textContent = String(scannedCount);
  if (totalEl) totalEl.textContent = String(Math.max(0, Math.floor(selectedTotal)));
  if (wallEl) wallEl.textContent = wallSeconds >= 10 ? wallSeconds.toFixed(1) : wallSeconds.toFixed(2);
}

/** Сводка по объединённому тексту выводов (без двойного счёта между модулями). */
export function mergedLinkStats(texts) {
  const all = (texts || []).filter(Boolean).join("\n");
  const m = all.match(/https?:\/\/[^\s<>"']+/gi) || [];
  const norm = m.map((u) => u.replace(/[),.;]+$/, "").toLowerCase());
  const uniqUrls = new Set(norm);
  const hosts = new Set();
  for (const u of uniqUrls) {
    try {
      const h = new URL(u).hostname;
      if (h) hosts.add(h.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  return { uniqueUrls: uniqUrls.size, uniqueDomains: hosts.size };
}

