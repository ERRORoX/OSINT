"""
Центральный реестр инструментов.
Интегрированные модули автоматически загружаются по manifest.json.
Вручную остаются только временные legacy-адаптеры.
"""
import re
import time
from typing import Any
from urllib.parse import urlparse

from .base import ToolBase

_URL_RE = re.compile(r"https?://[^\s<>'\"]+", re.I)


def _stats_from_text(text: str) -> dict[str, int]:
    """Реальные счётчики по тексту вывода инструмента (без эвристик «следа»)."""
    raw = _URL_RE.findall(text or "")
    cleaned: list[str] = []
    for u in raw:
        u = re.sub(r"[),.;]+$", "", u)
        cleaned.append(u)
    uniq_urls = {u.lower() for u in cleaned}
    hosts: set[str] = set()
    for u in uniq_urls:
        try:
            h = urlparse(u).hostname
            if h:
                hosts.add(h.lower())
        except Exception:
            continue
    return {
        "http_url_count": len(cleaned),
        "unique_urls": len(uniq_urls),
        "unique_hosts": len(hosts),
    }

# Only modules not yet migrated remain manually registered here.
from pathlib import Path

from .tool_anonsms import ToolAnonsms
from .tool_instagram_bruter import ToolInstagramBruter

from module_runtime import load_integrated_tools

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_LEGACY_TOOLS: list[ToolBase] = [
    ToolAnonsms(),
    ToolInstagramBruter(),
]
_INTEGRATED_TOOLS, _MODULE_RUNTIME_ISSUES = load_integrated_tools(_PROJECT_ROOT)
_TOOL_BY_ID = {tool.tool_id: tool for tool in _LEGACY_TOOLS}
for _tool in _INTEGRATED_TOOLS:
    _TOOL_BY_ID.setdefault(_tool.tool_id, _tool)

# Preserve the original UI order while runtime ownership moves into module folders.
_TOOL_ORDER = [
    "anonsms", "instagram-bruter", "grabcam", "photo-search", "google-osint",
    "theharvester", "domain-search", "sherlock", "maigret", "subfinder",
    "dnsx", "social-analyzer", "blackbird", "shodan", "ip-rdap",
]
TOOLS: list[ToolBase] = [_TOOL_BY_ID[tool_id] for tool_id in _TOOL_ORDER if tool_id in _TOOL_BY_ID]


def get_all_tools() -> list[dict]:
    """Список инструментов для API: id, name, description."""
    return [
        {"id": t.tool_id, "name": t.name, "description": t.description}
        for t in TOOLS
    ]


def get_tool(tool_id: str) -> ToolBase | None:
    """Найти инструмент по id."""
    for t in TOOLS:
        if t.tool_id == tool_id:
            return t
    return None


def run_tool(tool_id: str, params: dict[str, Any]) -> dict[str, Any]:
    """Запуск инструмента по id. Возвращает результат (включая success/error). При ошибке всегда output = error."""
    tool = get_tool(tool_id)
    if not tool:
        err = f"Unknown tool: {tool_id}"
        return {"success": False, "error": err, "output": err, "stats": {"duration_ms": 0, "http_url_count": 0, "unique_urls": 0, "unique_hosts": 0}}
    t0 = time.perf_counter()
    try:
        result = tool.run(params)
        if not result.get("success") and result.get("error") and "output" not in result:
            result["output"] = result["error"]
    except Exception as e:
        err = str(e)
        elapsed = int((time.perf_counter() - t0) * 1000)
        st = _stats_from_text(err)
        st["duration_ms"] = elapsed
        return {"success": False, "error": err, "output": err, "stats": st}
    elapsed = int((time.perf_counter() - t0) * 1000)
    blob = (result.get("output") or "") + "\n" + (result.get("error") or "")
    st = _stats_from_text(blob)
    st["duration_ms"] = elapsed
    result["stats"] = st
    return result
