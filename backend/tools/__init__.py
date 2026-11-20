"""Public tool API with lazy registry loading.

Importing a shared contract such as tools.base.ToolBase must not eagerly
import every optional integration and its third-party dependencies.
"""
from __future__ import annotations

from typing import Any

from .base import ToolBase


def get_all_tools() -> list[dict]:
    from .registry import get_all_tools as _get_all_tools
    return _get_all_tools()


def get_tool(tool_id: str) -> ToolBase | None:
    from .registry import get_tool as _get_tool
    return _get_tool(tool_id)


def run_tool(tool_id: str, params: dict[str, Any]) -> dict[str, Any]:
    from .registry import run_tool as _run_tool
    return _run_tool(tool_id, params)


__all__ = ["ToolBase", "get_all_tools", "get_tool", "run_tool"]
