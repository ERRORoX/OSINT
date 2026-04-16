/**
 * Общий вызов API инструментов. Не инициализирует UI — безопасно импортировать с любой страницы.
 */

const API = "/api";

export async function apiRun(toolId, params) {
  const res = await fetch(`${API}/tools/${toolId}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.message || res.statusText || "Ошибка запроса";
    throw new Error(msg);
  }
  return data;
}
