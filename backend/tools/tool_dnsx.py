"""Compatibility adapter; canonical implementation lives in tools/dnsx/backend/tool.py."""
from __future__ import annotations

import importlib.util
from pathlib import Path

_MODULE_FILE = Path(__file__).resolve().parents[2] / "tools" / "dnsx" / "backend" / "tool.py"
_SPEC = importlib.util.spec_from_file_location("_osint_module_dnsx", _MODULE_FILE)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError(f"Cannot load dnsx module from {_MODULE_FILE}")
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

ToolDnsx = _MODULE.ToolDnsx

__all__ = ["ToolDnsx"]
