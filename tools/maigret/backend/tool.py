"""
Инструмент Maigret — поиск имени пользователя по тысячам сайтов.
Приоритет: папка tools/maigret, затем системный maigret.
"""
import os
import re
import shutil
import subprocess
import sys
from typing import Any

from tools.base import ToolBase

_ANSI = re.compile(r"\x1b\[[?0-9;]*[a-zA-Z]")
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def _strip_ansi(text: str) -> str:
    return _ANSI.sub("", text)


def _ensure_maigret(timeout_sec: int = 900) -> tuple[bool, str]:
    """Install the published Maigret package into the active app interpreter when absent."""
    try:
        check = subprocess.run(
            [sys.executable, "-m", "pip", "show", "maigret"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=30,
        )
        if check.returncode == 0:
            return True, ""
        install = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "maigret"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=timeout_sec,
        )
        if install.returncode != 0:
            return False, (install.stderr or install.stdout or "pip install maigret завершился с ошибкой")[-5000:]
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "Установка Maigret превысила допустимое время ожидания."
    except Exception as exc:
        return False, str(exc)


def _run_maigret(username: str, timeout_sec: int = 180) -> tuple[str, str, int]:
    username = (username or "").strip()
    if not username or " " in username:
        return "", "Укажите одно имя пользователя без пробелов.", -1

    # Do not execute the bundled source checkout: it can be incomplete and its
    # settings.json layout differs between Maigret releases. Use the managed
    # package in the same interpreter as OSINT Panel.
    mg = shutil.which("maigret")
    if not mg:
        ready, install_error = _ensure_maigret()
        if not ready:
            return "", "Не удалось автоматически установить Maigret:\n" + install_error, -1
        mg = shutil.which("maigret")

    cmd = [mg, username, "--no-color"] if mg else [sys.executable, "-m", "maigret", username, "--no-color"]
    try:
        proc = subprocess.run(
            cmd, cwd=_ROOT, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout_sec,
            env={key: value for key, value in os.environ.items() if key not in {"PYTHONPATH"}},
        )
        out = _strip_ansi(proc.stdout or "")
        err = _strip_ansi(proc.stderr or "")
        return out, err, proc.returncode
    except subprocess.TimeoutExpired:
        return "", "Превышено время ожидания ({} сек).".format(timeout_sec), -1
    except FileNotFoundError:
        return "", "Maigret установлен, но исполняемый файл не найден. Перезапустите OSINT Panel.", -1
    except Exception as exc:
        return "", str(exc), -1


class ToolMaigret(ToolBase):
    @property
    def tool_id(self) -> str:
        return "maigret"

    @property
    def name(self) -> str:
        return "Maigret"

    @property
    def description(self) -> str:
        return "Поиск имени пользователя по тысячам сайтов (аналог Sherlock, больше баз)."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        username = (params.get("username") or "").strip()
        if not username:
            return {"success": False, "error": "Укажите имя пользователя."}
        if " " in username:
            return {"success": False, "error": "Введите одно имя пользователя без пробелов."}

        timeout = min(max(int(params.get("timeout", 180) or 180), 60), 300)
        out, err, code = _run_maigret(username, timeout_sec=timeout)
        combined = (out + "\n" + err).strip()
        return {
            "success": code == 0,
            "output": combined or "Нет результатов или ошибка.",
        }
