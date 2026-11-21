"""Compatibility adapter; canonical Domain Search code lives in tools/domain-search/backend/."""
from __future__ import annotations

import importlib.util
from pathlib import Path

_MODULE_FILE = Path(__file__).resolve().parents[2] / "tools" / "domain-search" / "backend" / "tool.py"
_SPEC = importlib.util.spec_from_file_location("_osint_module_domain_search", _MODULE_FILE)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError(f"Cannot load domain-search module from {_MODULE_FILE}")
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

ToolDomainSearch = _MODULE.ToolDomainSearch

__all__ = ["ToolDomainSearch"]
