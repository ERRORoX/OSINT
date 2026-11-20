"""ToolBase adapter for the canonical Domain Search module."""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

from tools.base import ToolBase

_DOMAIN_LOGIC_FILE = Path(__file__).resolve().parent / "domain_search.py"
_DOMAIN_SPEC = importlib.util.spec_from_file_location("_osint_domain_search_logic", _DOMAIN_LOGIC_FILE)
if _DOMAIN_SPEC is None or _DOMAIN_SPEC.loader is None:
    raise ImportError(f"Cannot load domain search logic from {_DOMAIN_LOGIC_FILE}")
DOMAIN_MODULE = importlib.util.module_from_spec(_DOMAIN_SPEC)
_DOMAIN_SPEC.loader.exec_module(DOMAIN_MODULE)


class ToolDomainSearch(ToolBase):
    @property
    def tool_id(self) -> str:
        return "domain-search"

    @property
    def name(self) -> str:
        return "Поиск по домену"

    @property
    def description(self) -> str:
        return "Информация по домену: WHOIS, DNS, SSL-сертификат, поддомены (crt.sh)."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        raw_domain = params.get("domain") or ""
        domain = DOMAIN_MODULE._normalize_domain(str(raw_domain))
        valid, error = DOMAIN_MODULE._validate_domain(domain)
        if not valid:
            return {"success": False, "error": error or "Некорректный домен."}
        try:
            result = DOMAIN_MODULE.run_domain_search(domain)
        except Exception as exc:
            return {"success": False, "error": str(exc)[:300]}
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error") or "Ошибка поиска домена.",
                "output": result.get("output") or "",
            }
        return {
            "success": True,
            "output": result.get("output") or "",
            "sections": result.get("sections") or {},
        }


__all__ = ["ToolDomainSearch", "DOMAIN_MODULE"]
