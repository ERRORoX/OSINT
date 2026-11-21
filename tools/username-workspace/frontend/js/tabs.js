export function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => (b.className = "tab-btn"));
      document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("visible"));
      const tab = btn.dataset.tab;
      const colors = { sherlock: "active-cyan", maigret: "active-purple", social: "active-green", blackbird: "active-red" };
      btn.classList.add(colors[tab] || "active-cyan");
      const pane = document.getElementById("tab-" + tab);
      if (pane) pane.classList.add("visible");
    });
  });
}

export function resetTabHits() {
  document.querySelectorAll(".js-tab-hit").forEach((el) => {
    el.textContent = "0";
    el.hidden = true;
  });
  document.querySelectorAll("#tabsNav .tab-btn").forEach((btn) => {
    btn.title = "";
  });
}

export function setTabHit(tabKey, statsOrNum) {
  const el = document.querySelector(`.js-tab-hit[data-tab-key="${tabKey}"]`);
  if (!el) return;

  let v = 0;
  if (statsOrNum != null && typeof statsOrNum === "object") {
    let n = Math.floor(statsOrNum.unique_hosts ?? 0);
    if (n === 0) n = Math.floor(statsOrNum.unique_urls ?? statsOrNum.http_url_count ?? 0);
    v = Math.max(0, n);
  } else {
    v = Math.max(0, Math.floor(Number(statsOrNum) || 0));
  }

  el.textContent = String(v);
  el.hidden = v <= 0;
  const btn = el.closest(".tab-btn");
  if (btn) {
    const label = btn.dataset.tab || tabKey;
    btn.title = v > 0 ? `Доменов/ссылок в выводе (${label}): ${v}` : "";
  }
}

