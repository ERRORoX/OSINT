export function wireVerifyInPane(pane) {
  const btn = pane.querySelector(".u-verify-btn");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";

  btn.addEventListener("click", async () => {
    const cards = [...pane.querySelectorAll("[data-verify-url]")];
    const urls = cards.map((c) => c.getAttribute("data-verify-url")).filter(Boolean);
    if (!urls.length) return;

    btn.disabled = true;
    btn.textContent = "Проверяю…";
    try {
      const res = await fetch("/api/verify/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json().catch(() => ({}));
      const results = Array.isArray(data.results) ? data.results : [];
      const byUrl = new Map(results.map((r) => [String(r.url || ""), r]));

      for (const c of cards) {
        const u = String(c.getAttribute("data-verify-url") || "");
        const r = byUrl.get(u);
        const badge = c.querySelector("[data-verify-badge]");
        if (!badge) continue;
        badge.classList.remove("is-ok", "is-bad", "is-warn");
        if (!r) {
          badge.textContent = "—";
          continue;
        }
        if (r.ok) {
          badge.textContent = `${r.status || 200}`;
          badge.classList.add("is-ok");
        } else if (r.status) {
          badge.textContent = `${r.status}`;
          badge.classList.add(r.status === 404 ? "is-bad" : "is-warn");
        } else {
          badge.textContent = String(r.error || "err");
          badge.classList.add("is-warn");
        }
      }
    } catch (e) {
      console.warn("[username] verify failed", e);
    } finally {
      btn.disabled = false;
      btn.textContent = "Проверить найденные";
    }
  });
}

