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
    cards.forEach((c) => { const badge = c.querySelector("[data-verify-badge]"); if (badge) { badge.textContent = "Проверка…"; badge.title = ""; } });
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
        if (r.hint === "not_found" || r.status === 404 || r.soft_404) {
          badge.textContent = "Не найден";
          badge.classList.add("is-bad");
          badge.title = r.soft_404 ? "Сайт вернул страницу-заглушку (soft 404)." : "Сервер сообщил, что страница не найдена.";
        } else if (r.hint === "blocked" || [401, 403, 429].includes(Number(r.status))) {
          badge.textContent = `${r.status || 'Блокировка}`;
          badge.classList.add("is-warn");
          badge.title = "Сайт ограничил проверку. Существование профиля неизвестно.";
        } else if (r.hint === "reachable_unconfirmed" || r.ok) {
          badge.textContent = `${r.status || 200} · не подтверждён`;
          badge.classList.add("is-warn");
          badge.title = r.redirected_to_root
            ? "Ссылка перенаправила на главную страницу сайта. Профиль не подтверждён."
            : "Страница отвечает, но HTTP 200 не доказывает существование профиля.";
        } else {
          badge.textContent = String(r.error || r.hint || "Не проверено");
          badge.classList.add("is-warn");
          badge.title = r.detail || "Не удалось надёжно проверить ссылку.";
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

