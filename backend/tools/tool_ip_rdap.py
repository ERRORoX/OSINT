"""Compatibility adapter for the IP/RDAP module.

The canonical implementation lives in tools/ip-rdap/backend/tool.py.
Keep this import path stable for the existing central tool registry.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

_MODULE_FILE = Path(__file__).resolve().parents[2] / "tools" / "ip-rdap" / "backend" / "tool.py"
_SPEC = importlib.util.spec_from_file_location("_osint_module_ip_rdap", _MODULE_FILE)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError(f"Cannot load IP/RDAP module from {_MODULE_FILE}")
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

ToolIPRDAP = _MODULE.ToolIPRDAP

__all__ = ["ToolIPRDAP"]
