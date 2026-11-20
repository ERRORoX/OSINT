"""Compatibility adapter; canonical implementation lives in tools/blackbird/backend/tool.py."""
from __future__ import annotations

import importlib.util
from pathlib import Path

_MODULE_FILE = Path(__file__).resolve().parents[2] / "tools" / "blackbird" / "backend" / "tool.py"
_SPEC = importlib.util.spec_from_file_location("_osint_module_blackbird", _MODULE_FILE)
if _SPEC is None or _SPEC.loader is None:
    raise ImportError(f"Cannot load blackbird module from {_MODULE_FILE}")
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

ToolBlackbird = _MODULE.ToolBlackbird

__all__ = ["ToolBlackbird"]
