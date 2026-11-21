"""Safe inventory and installer for OSINT tool dependencies."""
import importlib.metadata
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRA = {
    "maigret": ["maigret"], "sherlock": ["sherlock-project"],
    "blackbird": ["aiohttp", "python-dotenv", "rich", "reportlab"],
}
SYSTEM = {"domain-search": ["whois"], "subfinder": ["subfinder"], "dnsx": ["dnsx"]}


def _installed():
    return {d.metadata.get("Name", "").lower().replace("_", "-") for d in importlib.metadata.distributions()}


def inspect_tools():
    installed = _installed()
    rows = []
    for path in sorted((ROOT / "tools").glob("*/manifest.json")):
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if manifest.get("enabled") is False or manifest.get("status") not in {"integrated", "legacy"}:
            continue
        entrypoints = manifest.get("entrypoints") or {}
        if not entrypoints.get("backend_adapter"):
            continue
        tool_id = path.parent.name
        deps = manifest.get("dependencies") or {}
        packages = list(dict.fromkeys([str(x) for x in (deps.get("python") or []) + EXTRA.get(tool_id, [])]))
        missing = [p for p in packages if p.lower().replace("_", "-") not in installed]
        binaries = SYSTEM.get(tool_id, [])
        missing_bins = [b for b in binaries if not shutil.which(b)]
        rows.append({
            "id": tool_id, "name": manifest.get("name", tool_id),
            "status": "missing" if missing or missing_bins else "ready",
            "missing_packages": missing, "missing_binaries": missing_bins,
        })
    return rows


def install_missing_tools():
    initial = inspect_tools()
    results = []
    for row in initial:
        missing = row["missing_packages"]
        if not missing:
            result = {**row, "action": "none", "message": "Python-зависимости уже установлены."}
        else:
            if row["id"] == "blackbird":
                req = ROOT / "tools" / "blackbird" / "requirements.txt"
                command = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "-r", str(req)]
                cwd = str(req.parent)
            else:
                command = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", *missing]
                cwd = str(ROOT)
            try:
                proc = subprocess.run(command, cwd=cwd, capture_output=True, text=True,
                    encoding="utf-8", errors="replace", timeout=900)
                output = (proc.stderr or proc.stdout or "").strip()[-1800:]
                result = {**row, "action": "installed" if proc.returncode == 0 else "failed",
                    "message": "Установка завершена." if proc.returncode == 0 else (output or "pip завершился с ошибкой.")}
            except subprocess.TimeoutExpired:
                result = {**row, "action": "failed", "message": "Превышено время установки (15 минут)."}
            except Exception as exc:
                result = {**row, "action": "failed", "message": str(exc)[:1800]}
        results.append(result)
    final = {r["id"]: r for r in inspect_tools()}
    for row in results:
        current = final.get(row["id"])
        if current:
            row.update({k: current[k] for k in ("status", "missing_packages", "missing_binaries")})
        if row["missing_binaries"]:
            row["message"] = (row.get("message", "") + " Не найдены системные программы: " +
                ", ".join(row["missing_binaries"]) + ". Их нужно установить через пакетный менеджер ОС.")
    return results
