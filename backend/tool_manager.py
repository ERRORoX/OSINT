"""Inventory and managed installation for OSINT tool dependencies.

Python packages are installed into the interpreter running the panel. Known
system binaries are installed with the host OS package manager; privileged
operations use sudo -n first and pkexec as a desktop-authenticated fallback.
"""
import importlib.metadata
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRA = {
    "maigret": ["maigret"],
    "sherlock": ["sherlock-project"],
    "blackbird": ["aiohttp", "python-dotenv", "rich", "reportlab"],
    "social-analyzer": ["beautifulsoup4", "tld", "termcolor", "langdetect", "requests", "lxml", "galeodes"],
}
# Binary name -> package name for common Linux distributions.
SYSTEM = {
    "domain-search": ["whois"],
    "subfinder": ["subfinder"],
    "dnsx": ["dnsx"],
}
PACKAGE_NAMES = {
    "whois": {"apt": "whois", "dnf": "whois", "pacman": "whois", "zypper": "whois", "apk": "whois"},
    "subfinder": {"apt": "subfinder", "dnf": "subfinder", "pacman": "subfinder", "zypper": "subfinder", "apk": "subfinder"},
    "dnsx": {"apt": "dnsx", "dnf": "dnsx", "pacman": "dnsx", "zypper": "dnsx", "apk": "dnsx"},
    "nmap": {"apt": "nmap", "dnf": "nmap", "pacman": "nmap", "zypper": "nmap", "apk": "nmap"},
    "exiftool": {"apt": "libimage-exiftool-perl", "dnf": "perl-Image-ExifTool", "pacman": "perl-image-exiftool", "zypper": "perl-Image-ExifTool", "apk": "perl-image-exiftool"},
    "tesseract": {"apt": "tesseract-ocr", "dnf": "tesseract", "pacman": "tesseract", "zypper": "tesseract-ocr", "apk": "tesseract-ocr"},
    "ffmpeg": {"apt": "ffmpeg", "dnf": "ffmpeg", "pacman": "ffmpeg", "zypper": "ffmpeg", "apk": "ffmpeg"},
    "git": {"apt": "git", "dnf": "git", "pacman": "git", "zypper": "git", "apk": "git"},
    "curl": {"apt": "curl", "dnf": "curl", "pacman": "curl", "zypper": "curl", "apk": "curl"},
    "jq": {"apt": "jq", "dnf": "jq", "pacman": "jq", "zypper": "jq", "apk": "jq"},
}
MANAGERS = (
    ("apt-get", ["apt-get", "install", "-y"]),
    ("dnf", ["dnf", "install", "-y"]),
    ("pacman", ["pacman", "-S", "--noconfirm", "--needed"]),
    ("zypper", ["zypper", "--non-interactive", "install", "--no-recommends"]),
    ("apk", ["apk", "add", "--no-cache"]),
    ("brew", ["brew", "install"]),
)


def _installed():
    return {d.metadata.get("Name", "").lower().replace("_", "-") for d in importlib.metadata.distributions()}


def _package_manager():
    for name, prefix in MANAGERS:
        executable = shutil.which(name)
        if executable:
            return name, executable, prefix[1:]
    return None, None, None


def _system_packages(manifest, tool_id):
    declared = (manifest.get("dependencies") or {}).get("system") or []
    requested = list(dict.fromkeys([str(x).strip().lower() for x in declared if str(x).strip()] + SYSTEM.get(tool_id, [])))
    manager, _, _ = _package_manager()
    if not manager:
        return requested
    package_manager_key = "apt" if manager == "apt-get" else manager
    return [PACKAGE_NAMES.get(name, {}).get(package_manager_key, name) for name in requested]


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
        declared_system = list(dict.fromkeys([str(x).strip().lower() for x in (deps.get("system") or []) if str(x).strip()] + SYSTEM.get(tool_id, [])))
        missing_bins = [b for b in declared_system if not shutil.which(b)]
        manager, _, _ = _package_manager()
        package_names = _system_packages(manifest, tool_id)
        rows.append({
            "id": tool_id,
            "name": manifest.get("name", tool_id),
            "status": "missing" if missing or missing_bins else "ready",
            "missing_packages": missing,
            "missing_binaries": missing_bins,
            "missing_system_packages": package_names if missing_bins else [],
            "package_manager": manager,
        })
    return rows


def _run_system_install(packages, timeout=1200):
    manager, executable, suffix = _package_manager()
    if not manager:
        return False, "Не найден поддерживаемый пакетный менеджер ОС."
    safe_packages = [p for p in packages if re.fullmatch(r"[A-Za-z0-9+_.:-]+", p)]
    if not safe_packages:
        return False, "Нет безопасно распознанных системных пакетов."
    command = [executable, *suffix, *safe_packages]
    if manager == "brew":
        # Homebrew normally installs into the current user's prefix; never use sudo.
        attempts = [("brew", command)]
    elif hasattr(os, "geteuid") and os.geteuid() == 0:
        attempts = [("root", command)]
    else:
        attempts = []
        # Prefer desktop Polkit so KDE/GNOME can display a native
        # administrator-authentication dialog.
        pkexec = shutil.which("pkexec")
        sudo = shutil.which("sudo")
        if pkexec:
            attempts.append(("pkexec", [pkexec, *command]))
        if sudo:
            attempts.append(("sudo", [sudo, "-n", *command]))
        if not attempts:
            return False, "Не найден pkexec или sudo. Для системной установки нужны права администратора."
    last_output = ""
    for auth_method, attempt in attempts:
        try:
            # Keep the desktop session environment so the Polkit agent can
            # display its native confirmation dialog.
            child_env = {**os.environ, "DEBIAN_FRONTEND": "noninteractive"}
            proc = subprocess.run(attempt, cwd=str(ROOT), capture_output=True, text=True,
                encoding="utf-8", errors="replace", timeout=timeout, env=child_env)
            last_output = (proc.stderr or proc.stdout or "").strip()[-3500:]
            if proc.returncode == 0:
                return True, "Установлено через " + manager + " с подтверждением " + auth_method + ": " + ", ".join(safe_packages)
            auth_error = any(s in last_output.lower() for s in ("a password is required", "authentication is required", "not authorized", "authorization required", "no authentication agent"))
            if auth_method == "pkexec" and auth_error and sudo:
                continue
            if not auth_error:
                break
        except subprocess.TimeoutExpired:
            return False, "Установка системных пакетов превысила 20 минут."
        except Exception as exc:
            last_output = str(exc)
    return False, last_output or "Пакетный менеджер завершился с ошибкой."


def install_missing_tools():
    initial = inspect_tools()
    results = []
    for row in initial:
        messages = []
        action = "none"
        if row["missing_packages"]:
            if row["id"] == "blackbird":
                req = ROOT / "tools" / "blackbird" / "requirements.txt"
                command = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "-r", str(req)]
                cwd = str(req.parent)
            else:
                command = [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", *row["missing_packages"]]
                cwd = str(ROOT)
            try:
                proc = subprocess.run(command, cwd=cwd, capture_output=True, text=True,
                    encoding="utf-8", errors="replace", timeout=900)
                output = (proc.stderr or proc.stdout or "").strip()[-1800:]
                if proc.returncode == 0:
                    action = "installed"
                    messages.append("Python-зависимости установлены.")
                else:
                    action = "failed"
                    messages.append(output or "pip завершился с ошибкой.")
            except subprocess.TimeoutExpired:
                action = "failed"
                messages.append("Установка Python-зависимостей превысила 15 минут.")
            except Exception as exc:
                action = "failed"
                messages.append(str(exc)[:1800])

        if row.get("missing_system_packages"):
            ok, message = _run_system_install(row["missing_system_packages"])
            messages.append(message)
            if not ok:
                action = "failed"
            elif action == "none":
                action = "installed"

        results.append({**row, "action": action, "message": " ".join(messages) or "Зависимости уже установлены."})

    final = {r["id"]: r for r in inspect_tools()}
    for row in results:
        current = final.get(row["id"])
        if current:
            row.update({k: current[k] for k in ("status", "missing_packages", "missing_binaries", "missing_system_packages", "package_manager")})
            if current["status"] == "ready" and row["action"] != "failed":
                row["message"] = (row.get("message", "") + " Проверка после установки пройдена.").strip()
    return results
