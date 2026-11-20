"""Controlled runtime loader for integrated OSINT Panel modules.

Only explicitly integrated modules at the canonical tools/<id>/backend/tool.py
location are imported. Legacy modules continue using the compatibility registry.
"""
from __future__ import annotations

import importlib.util
import os
import re
import sys
from pathlib import Path
from typing import Any

from module_registry import discover_modules
from tools.base import ToolBase

_CLASS_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_RUNTIME_ISSUES: list[dict[str, str]] = []


def get_runtime_module_issues() -> list[dict[str, str]]:
    """Return a copy of errors raised while loading integrated modules."""
    return [dict(item) for item in _RUNTIME_ISSUES]


def load_integrated_tools(project_root: str | os.PathLike[str] | None = None) -> tuple[list[ToolBase], list[dict[str, str]]]:
    """Load only valid integrated modules with the strict canonical backend path."""
    root = Path(project_root or Path(__file__).resolve().parents[1]).resolve()
    loaded: list[ToolBase] = []
    issues: list[dict[str, str]] = []
    seen_tool_ids: set[str] = set()

    def issue(module_id: str, code: str, message: str) -> None:
        issues.append({
            "module_id": module_id,
            "code": code,
            "message": message,
            "severity": "error",
        })

    discovery = discover_modules(root)
    for item in discovery["modules"]:
        if not item.get("valid") or not item.get("enabled") or item.get("status") != "integrated":
            continue

        module_id = item["id"]
        entrypoints = item.get("entrypoints") or {}
        relative_path = entrypoints.get("backend_adapter")
        class_name = entrypoints.get("tool_class")

        # Integrated frontend workspaces may have no backend tool class.
        if not relative_path:
            continue
        expected_path = f"tools/{module_id}/backend/tool.py"
        if relative_path != expected_path:
            issue(module_id, "noncanonical_runtime_path", f"Integrated backend path must be {expected_path}.")
            continue
        if not isinstance(class_name, str) or not _CLASS_NAME_RE.fullmatch(class_name):
            issue(module_id, "invalid_tool_class", "Integrated backend module must declare a valid entrypoints.tool_class.")
            continue

        module_path = (root / expected_path).resolve()
        try:
            if os.path.commonpath((str(root), str(module_path))) != str(root) or not module_path.is_file():
                issue(module_id, "runtime_file_missing", f"Canonical backend file is missing or outside the project: {expected_path}.")
                continue
        except (OSError, ValueError):
            issue(module_id, "runtime_path_error", "Cannot resolve the canonical backend module path.")
            continue

        import_name = "_osint_runtime_" + module_id.replace("-", "_")
        sys.modules.pop(import_name, None)
        try:
            spec = importlib.util.spec_from_file_location(import_name, module_path)
            if spec is None or spec.loader is None:
                raise ImportError("Python could not create a module loader.")
            module = importlib.util.module_from_spec(spec)
            sys.modules[import_name] = module
            spec.loader.exec_module(module)

            tool_class = getattr(module, class_name, None)
            if not isinstance(tool_class, type) or not issubclass(tool_class, ToolBase):
                raise TypeError(f"{class_name} must be a ToolBase subclass.")
            tool = tool_class()
            if tool.tool_id != module_id:
                raise ValueError(f"Tool id mismatch: manifest={module_id}, class={tool.tool_id}.")
            if tool.tool_id in seen_tool_ids:
                raise ValueError(f"Duplicate runtime tool id: {tool.tool_id}.")
            seen_tool_ids.add(tool.tool_id)
            loaded.append(tool)
        except Exception as exc:
            sys.modules.pop(import_name, None)
            issue(module_id, "runtime_load_error", f"{type(exc).__name__}: {str(exc)[:240]}")

    _RUNTIME_ISSUES.clear()
    _RUNTIME_ISSUES.extend(issues)
    return loaded, issues
