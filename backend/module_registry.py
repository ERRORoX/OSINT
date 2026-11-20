"""Read-only discovery and validation for OSINT Panel module manifests.

Manifests are treated strictly as data. This module never imports or executes
paths declared by a manifest.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

_MODULE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")
_VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$")
_ALLOWED_STATUS = {"planned", "legacy", "migrating", "integrated", "disabled"}
_ALLOWED_CATEGORIES = {
    "domain", "identity", "photo", "network", "education",
    "utility", "workspace", "other",
}


def _inside(root: Path, candidate: Path) -> bool:
    """Return true only when candidate resolves inside root."""
    try:
        return os.path.commonpath((str(root.resolve()), str(candidate.resolve()))) == str(root.resolve())
    except (OSError, ValueError):
        return False


def _validate_manifest(data: Any, expected_id: str, module_dir: Path, project_root: Path) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []

    def issue(code: str, message: str, severity: str = "error") -> None:
        issues.append({"code": code, "message": message, "severity": severity})

    if not isinstance(data, dict):
        return [{"code": "manifest_type", "message": "Manifest must contain a JSON object.", "severity": "error"}]

    required = ("schema_version", "id", "name", "version", "category", "status", "entrypoints")
    for key in required:
        if key not in data:
            issue("required_field", f"Missing required field: {key}.")

    if data.get("schema_version") != 1:
        issue("schema_version", "Unsupported schema_version; expected 1.")
    module_id = data.get("id")
    if not isinstance(module_id, str) or not _MODULE_ID_RE.fullmatch(module_id):
        issue("module_id", "Invalid module id.")
    elif module_id != expected_id:
        issue("directory_id_mismatch", f"Manifest id '{module_id}' does not match directory '{expected_id}'.")

    if not isinstance(data.get("name"), str) or not data["name"].strip():
        issue("module_name", "Module name must be a non-empty string.")
    if not isinstance(data.get("version"), str) or not _VERSION_RE.fullmatch(data["version"]):
        issue("module_version", "Version must use semantic version format (major.minor.patch).")
    if data.get("category") not in _ALLOWED_CATEGORIES:
        issue("module_category", "Unknown module category.")
    if data.get("status") not in _ALLOWED_STATUS:
        issue("module_status", "Unknown module status.")
    if "enabled" in data and not isinstance(data["enabled"], bool):
        issue("enabled_type", "enabled must be a boolean.")

    entrypoints = data.get("entrypoints")
    if not isinstance(entrypoints, dict):
        issue("entrypoints_type", "entrypoints must be an object.")
    else:
        for key in ("frontend", "backend_adapter", "manifest_readme"):
            value = entrypoints.get(key)
            if value is None:
                continue
            if not isinstance(value, str) or not value.strip():
                issue("entrypoint_type", f"entrypoints.{key} must be a non-empty relative path.")
                continue
            rel = Path(value)
            if "\\\\" in value or "\\x00" in value or re.match(r"^[A-Za-z]:", value) or rel.is_absolute() or ".." in rel.parts:
                issue("unsafe_entrypoint", f"Unsafe path in entrypoints.{key}.")
                continue
            # Entry points may intentionally point to legacy files elsewhere in the repository.
            target = (project_root / rel)
            if not _inside(project_root, target):
                issue("unsafe_entrypoint", f"Path escapes project root: entrypoints.{key}.")
            elif not target.is_file():
                issue("missing_entrypoint", f"Referenced file does not exist: {value}.", "warning")
        tool_class = entrypoints.get("tool_class")
        if tool_class is not None and (
            not isinstance(tool_class, str)
            or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", tool_class)
        ):
            issue("tool_class_type", "entrypoints.tool_class must be a valid Python class name.")
        if data.get("status") == "integrated" and entrypoints.get("backend_adapter") and not tool_class:
            issue("tool_class_missing", "Integrated backend modules must declare entrypoints.tool_class.")

    legacy_paths = data.get("legacy_paths", [])
    if not isinstance(legacy_paths, list) or any(not isinstance(p, str) for p in legacy_paths):
        issue("legacy_paths_type", "legacy_paths must be an array of strings.")
    else:
        for value in legacy_paths:
            rel = Path(value)
            if "\\\\" in value or "\\x00" in value or re.match(r"^[A-Za-z]:", value) or rel.is_absolute() or ".." in rel.parts:
                issue("unsafe_legacy_path", "A legacy path is absolute or escapes the project root.")
                continue
            target = project_root / rel
            if not _inside(project_root, target):
                issue("unsafe_legacy_path", "A legacy path escapes the project root.")
            elif not target.exists():
                issue("missing_legacy_path", f"Legacy path does not exist: {value}.", "warning")

    dependencies = data.get("dependencies", {})
    if not isinstance(dependencies, dict):
        issue("dependencies_type", "dependencies must be an object.")
    else:
        for key in ("python", "system", "optional"):
            values = dependencies.get(key, [])
            if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() for v in values):
                issue("dependencies_type", f"dependencies.{key} must be an array of non-empty strings.")

    capabilities = data.get("capabilities", [])
    if not isinstance(capabilities, list) or any(not isinstance(v, str) for v in capabilities):
        issue("capabilities_type", "capabilities must be an array of strings.")

    return issues


def discover_modules(project_root: str | os.PathLike[str] | None = None) -> dict[str, Any]:
    """Discover module manifests without importing module code.

    Only direct child directories of <project_root>/tools are considered.
    Invalid manifests are reported but never executed.
    """
    root = Path(project_root or Path(__file__).resolve().parents[1]).resolve()
    tools_dir = root / "tools"
    modules: list[dict[str, Any]] = []
    global_issues: list[dict[str, str]] = []
    seen_ids: set[str] = set()

    if not tools_dir.is_dir() or not _inside(root, tools_dir):
        return {
            "modules": [],
            "summary": {"discovered": 0, "valid": 0, "invalid": 0, "enabled": 0},
            "issues": [{"code": "tools_directory_missing", "message": "Tools directory not found.", "severity": "error"}],
        }

    for module_dir in sorted(tools_dir.iterdir(), key=lambda p: p.name.lower()):
        if not module_dir.is_dir() or not _inside(tools_dir, module_dir):
            continue
        manifest_path = module_dir / "manifest.json"
        if not manifest_path.is_file() or not _inside(module_dir, manifest_path):
            continue

        module_id = module_dir.name
        item_issues: list[dict[str, str]] = []
        try:
            with manifest_path.open("r", encoding="utf-8") as stream:
                data = json.load(stream)
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            data = {}
            item_issues.append({"code": "manifest_read_error", "message": f"Cannot read manifest: {exc}", "severity": "error"})

        item_issues.extend(_validate_manifest(data, module_id, module_dir, root))
        manifest_id = data.get("id") if isinstance(data, dict) else None
        if isinstance(manifest_id, str):
            if manifest_id in seen_ids:
                item_issues.append({"code": "duplicate_module_id", "message": f"Duplicate module id: {manifest_id}.", "severity": "error"})
            seen_ids.add(manifest_id)

        errors = sum(1 for entry in item_issues if entry["severity"] == "error")
        modules.append({
            "id": module_id,
            "name": data.get("name", module_id) if isinstance(data, dict) else module_id,
            "description": data.get("description", "") if isinstance(data, dict) else "",
            "version": data.get("version") if isinstance(data, dict) else None,
            "category": data.get("category") if isinstance(data, dict) else None,
            "status": data.get("status", "invalid") if isinstance(data, dict) else "invalid",
            "enabled": bool(data.get("enabled", True)) if isinstance(data, dict) else False,
            "valid": errors == 0,
            "manifest": str(manifest_path.relative_to(root)),
            "entrypoints": data.get("entrypoints", {}) if isinstance(data, dict) and isinstance(data.get("entrypoints"), dict) else {},
            "issues": item_issues,
        })

    valid = sum(1 for item in modules if item["valid"])
    enabled = sum(1 for item in modules if item["valid"] and item["enabled"] and item["status"] != "disabled")
    return {
        "modules": modules,
        "summary": {
            "discovered": len(modules),
            "valid": valid,
            "invalid": len(modules) - valid,
            "enabled": enabled,
        },
        "issues": global_issues,
    }
