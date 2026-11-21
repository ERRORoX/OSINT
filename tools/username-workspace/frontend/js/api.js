export async function apiRun(toolId, params) {
  const res = await fetch(`/api/tools/${toolId}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || res.statusText || "Ошибка");
  return data;
}

