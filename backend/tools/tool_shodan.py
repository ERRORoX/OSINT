"""
Инструмент Shodan: поиск по домену (hostname), по произвольному запросу и информация по IP.
Использует библиотеку из tools/shodan-python. Ключ API: SHODAN_API_KEY или TH_SHODAN_KEY.
Поддержка бесплатного плана: при 403 по IP — fallback на InternetDB (без ключа); при 403 по поиску — повтор без фильтра (только 1-я страница).
"""
import os
import sys
import json
import urllib.request
import urllib.error
from typing import Any

from .base import ToolBase

# Путь к библиотеке shodan в tools/shodan-python
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_BACKEND_DIR))
_SHODAN_LIB = os.path.join(_ROOT, "tools", "shodan-python")
if os.path.isdir(_SHODAN_LIB) and _SHODAN_LIB not in sys.path:
    sys.path.insert(0, _SHODAN_LIB)


def _get_api_key() -> str | None:
    """Ключ Shodan: сначала отдельный ключ инструмента, затем ключ theHarvester."""
    key = (os.environ.get("SHODAN_API_KEY") or os.environ.get("TH_SHODAN_KEY") or "").strip()
    return key or None


# Пределы для бесплатного плана: только 1-я страница, до 100 результатов (без фильтров не тратятся кредиты)
FREE_PLAN_PAGE = 1
FREE_PLAN_LIMIT = 100

# URL бесплатного InternetDB API (поиск по IP без ключа)
INTERNETDB_URL = "https://internetdb.shodan.io"


def _internetdb_lookup(ip: str) -> dict[str, Any] | None:
    """Запрос к бесплатному InternetDB API (порты, CVE, hostnames). Без API-ключа."""
    try:
        req = urllib.request.Request(
            f"{INTERNETDB_URL}/{ip}",
            headers={"User-Agent": "OSINT-Panel/1.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError, OSError):
        return None


def _format_internetdb_output(data: dict, ip: str) -> str:
    """Форматирует ответ InternetDB для вывода."""
    lines = [f"IP: {ip} (данные InternetDB, бесплатный API)", ""]
    if data.get("hostnames"):
        lines.append("Hostnames: " + ", ".join(data["hostnames"]))
    if data.get("ports"):
        lines.append("Открытые порты: " + ", ".join(map(str, sorted(data["ports"]))))
    if data.get("tags"):
        lines.append("Теги: " + ", ".join(data["tags"]))
    if data.get("cpes"):
        lines.append("CPE: " + ", ".join(data["cpes"][:20]))
        if len(data["cpes"]) > 20:
            lines[-1] += f" ... (+{len(data['cpes'])-20})"
    if data.get("vulns"):
        lines.append("Уязвимости (CVE): " + ", ".join(sorted(data["vulns"])[:15]))
        if len(data["vulns"]) > 15:
            lines[-1] += f" ... (+{len(data['vulns'])-15})"
    return "\n".join(lines) if len(lines) > 2 else json.dumps(data, ensure_ascii=False, indent=2)


def _explain_shodan_error(err: str) -> str:
    """Делает сообщения об ошибках Shodan понятнее для пользователя."""
    if not err:
        return err
    err_lower = err.lower()
    if "403" in err or "forbidden" in err_lower or "access denied" in err_lower:
        return (
            "Shodan вернул 403 Forbidden: доступ к этому методу API запрещён для вашего ключа. "
            "Часто это ограничение бесплатного тарифа (поиск по hostname/фильтрам, полные результаты). "
            "Проверьте план на https://account.shodan.io/ и права ключа."
        )
    if "401" in err or "invalid api key" in err_lower or "invalid key" in err_lower:
        return "Неверный или неактивный API-ключ Shodan. Проверьте ключ в настройках и на https://account.shodan.io/"
    return err


def _format_search_output(data: dict) -> str:
    """Форматирует результат search() в читаемый текст."""
    lines = []
    total = data.get("total", 0)
    lines.append(f"Всего результатов: {total}")
    matches = data.get("matches") or []
    for i, m in enumerate(matches[:100], 1):  # не более 100 в вывод
        ip = m.get("ip_str") or m.get("ip") or "—"
        port = m.get("port", "—")
        org = (m.get("org") or "").strip() or "—"
        product = (m.get("product") or m.get("data") or "").strip()
        if isinstance(product, str) and len(product) > 80:
            product = product[:77] + "..."
        lines.append(f"\n[{i}] {ip}:{port}  org: {org}")
        if product:
            lines.append(f"    {product}")
    if len(matches) > 100:
        lines.append(f"\n... показаны первые 100 из {len(matches)}")
    return "\n".join(lines) if lines else "Нет результатов."


def _format_host_output(data: dict) -> str:
    """Форматирует результат host() в читаемый текст."""
    lines = []
    ip = data.get("ip_str") or data.get("ip") or "—"
    org = (data.get("org") or "").strip() or "—"
    city = (data.get("city") or "").strip() or "—"
    country = (data.get("country_name") or data.get("country_code") or "—")
    lines.append(f"IP: {ip}")
    lines.append(f"Организация: {org}")
    lines.append(f"Город: {city}, Страна: {country}")
    ports = data.get("ports") or []
    if ports:
        lines.append(f"Порты: {', '.join(map(str, sorted(ports)))}")
    data_list = data.get("data") or []
    for block in data_list[:50]:
        port = block.get("port", "—")
        product = (block.get("product") or "").strip()
        banner = (block.get("data") or "").strip()
        if isinstance(banner, str) and len(banner) > 200:
            banner = banner[:197] + "..."
        lines.append(f"\n--- порт {port} ---")
        if product:
            lines.append(f"  product: {product}")
        if banner:
            lines.append(f"  {banner}")
    if len(data_list) > 50:
        lines.append(f"\n... показаны первые 50 записей из {len(data_list)}")
    return "\n".join(lines) if lines else json.dumps(data, ensure_ascii=False, indent=2)


class ToolShodan(ToolBase):
    @property
    def tool_id(self) -> str:
        return "shodan"

    @property
    def name(self) -> str:
        return "Shodan"

    @property
    def description(self) -> str:
        return (
            "Поиск по домену/запросу и информация по IP. Бесплатный план: 1-я страница без фильтров; "
            "по IP — Shodan или InternetDB (без ключа). Ключ в настройках — опционально для поиска."
        )

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        domain = (params.get("domain") or "").strip()
        query = (params.get("query") or "").strip()
        ip = (params.get("ip") or "").strip()
        page = max(1, min(10, int(params.get("page") or 1)))
        limit = max(1, min(100, int(params.get("limit") or 50)))

        # Режим: по IP — без ключа используем бесплатный InternetDB
        if ip:
            if not _get_api_key():
                idb = _internetdb_lookup(ip)
                if idb:
                    return {
                        "success": True,
                        "output": _format_internetdb_output(idb, ip),
                        "source": "internetdb",
                        "raw": idb,
                    }
                return {"success": False, "error": "Не удалось получить данные по IP (InternetDB). Проверьте адрес."}
            try:
                from shodan import Shodan
                from shodan.exception import APIError
            except ImportError as e:
                return {"success": False, "error": f"Библиотека Shodan не найдена: {e!s}"}
            try:
                api = Shodan(_get_api_key())
            except Exception as e:
                return {"success": False, "error": f"Ошибка инициализации API: {e!s}"}

            try:
                data = api.host(ip, minify=False)
                return {
                    "success": True,
                    "output": _format_host_output(data),
                    "raw": data,
                }
            except APIError as e:
                err = str(e)
                if "403" in err or "forbidden" in err.lower() or "access denied" in err.lower():
                    idb = _internetdb_lookup(ip)
                    if idb:
                        return {
                            "success": True,
                            "output": _format_internetdb_output(idb, ip),
                            "source": "internetdb",
                            "raw": idb,
                        }
                return {"success": False, "error": _explain_shodan_error(err)}
            except Exception as e:
                return {"success": False, "error": str(e)[:300]}

        # Поиск (domain/query) требует API-ключ
        api_key = _get_api_key()
        if not api_key:
            return {
                "success": False,
                "error": "Для поиска по домену/запросу нужен API-ключ Shodan. Укажите в настройках (API ключи). Поиск по IP доступен без ключа (InternetDB).",
            }
        try:
            from shodan import Shodan
            from shodan.exception import APIError
        except ImportError as e:
            return {"success": False, "error": f"Библиотека Shodan не найдена: {e!s}"}
        try:
            api = Shodan(api_key)
        except Exception as e:
            return {"success": False, "error": f"Ошибка инициализации API: {e!s}"}

        # Режим: поиск по запросу или по домену (hostname:domain)
        search_query = query if query else (f"hostname:{domain}" if domain else "")
        if not search_query:
            return {
                "success": False,
                "error": "Укажите домен (domain), произвольный запрос (query) или IP (ip).",
            }

        try:
            result = api.search(search_query, page=page, limit=limit, minify=False)
            return {
                "success": True,
                "output": _format_search_output(result),
                "total": result.get("total"),
                "raw": {"total": result.get("total"), "matches": result.get("matches")},
            }
        except APIError as e:
            err = str(e)
            # Бесплатный план: фильтры (hostname: и т.д.) требуют кредитов → 403. Повтор без фильтра, только 1-я страница.
            if ("403" in err or "forbidden" in err.lower()) and search_query.strip().startswith("hostname:"):
                plain_query = search_query.replace("hostname:", "").strip()
                if plain_query:
                    try:
                        result = api.search(plain_query, page=1, limit=FREE_PLAN_LIMIT, minify=False)
                        note = (
                            "[Бесплатный план Shodan: поиск по фильтру hostname недоступен без кредитов. "
                            "Показан обычный поиск по запросу «{}», только 1-я страница.]\n\n"
                        ).format(plain_query)
                        return {
                            "success": True,
                            "output": note + _format_search_output(result),
                            "total": result.get("total"),
                            "raw": {"total": result.get("total"), "matches": result.get("matches")},
                        }
                    except APIError:
                        pass
            return {"success": False, "error": _explain_shodan_error(err)}
        except Exception as e:
            return {"success": False, "error": str(e)[:300]}
