"""
Реестр инструментов. Чтобы добавить новый инструмент:
1. Создать файл backend/tools/tool_<id>.py с классом, наследующим ToolBase.
2. Добавить один импорт и одну строку в TOOLS ниже.
Остальной код не трогать.
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

# Импорты модулей инструментов (по одному на инструмент)
from .tool_anonsms import ToolAnonsms
from .tool_instagram_bruter import ToolInstagramBruter
from .tool_grabcam import ToolGrabcam
from .tool_theharvester import ToolTheharvester
from .tool_google_osint import ToolGoogleOsint
from .tool_domain_search import ToolDomainSearch
from .tool_sherlock import ToolSherlock
from .tool_maigret import ToolMaigret
from .tool_subfinder import ToolSubfinder
from .tool_dnsx import ToolDnsx
from .tool_social_analyzer import ToolSocialAnalyzer
from .tool_blackbird import ToolBlackbird
from .tool_shodan import ToolShodan
from .tool_ip_rdap import ToolIPRDAP
from .tool_photo_search import ToolPhotoSearch

# Список всех инструментов (Holehe и h8mail объединены в Google OSINT)
TOOLS: list[ToolBase] = [
    ToolAnonsms(),
    ToolInstagramBruter(),
    ToolGrabcam(),
    ToolPhotoSearch(),
    ToolGoogleOsint(),
    ToolTheharvester(),
    ToolDomainSearch(),
    ToolSherlock(),
    ToolMaigret(),
    ToolSubfinder(),
    ToolDnsx(),
    ToolSocialAnalyzer(),
    ToolBlackbird(),
    ToolShodan(),
    ToolIPRDAP(),
]


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
