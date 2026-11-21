"""
Инструмент Sherlock — поиск имени пользователя в соцсетях.
Приоритет: папка tools/sherlock, затем системный sherlock-project.
"""
import os
import re
import importlib.util
import shutil
import subprocess
import sys
from typing import Any

from tools.base import ToolBase

_ANSI = re.compile(r"\x1b\[[?0-9;]*[a-zA-Z]")
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def _strip_ansi(text: str) -> str:
    return _ANSI.sub("", text)


def _ensure_sherlock(timeout_sec: int = 900) -> tuple[bool, str]:
    """Install Sherlock into the active panel interpreter when it is missing."""
    try:
        check = subprocess.run(
            [sys.executable, "-m", "pip", "show", "sherlock-project"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30,
        )
        if check.returncode == 0 and importlib.util.find_spec("sherlock_project"):
            return True, ""
        install = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "sherlock-project"],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout_sec,
        )
        if install.returncode != 0:
            return False, (install.stderr or install.stdout or "pip install sherlock-project завершился с ошибкой")[-5000:]
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "Установка Sherlock превысила допустимое время ожидания."
    except Exception as exc:
        return False, str(exc)


def _run_sherlock(username: str, timeout_sec: int = 180) -> tuple[str, str, int]:
    username = (username or "").strip()
    if not username or " " in username:
        return "", "Укажите одно имя пользователя без пробелов.", -1

    ready, install_error = _ensure_sherlock()
    if not ready:
        return "", "Не удалось автоматически установить Sherlock:\\n" + install_error, -1

    cmd = [sys.executable, "-m", "sherlock_project", username, "--print-all", "--timeout", "15"]
    try:
        proc = subprocess.run(
            cmd, cwd=_ROOT, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout_sec,
            env={key: value for key, value in os.environ.items() if key != "PYTHONPATH"},
        )
        out = _strip_ansi(proc.stdout or "")
        err = _strip_ansi(proc.stderr or "")
        return out, err, proc.returncode
    except subprocess.TimeoutExpired:
        return "", "Превышено время ожидания ({} сек).".format(timeout_sec), -1
    except FileNotFoundError:
        return "", "Модуль Sherlock установлен, но не запускается в текущем Python.", -1
    except Exception as exc:
        return "", str(exc), -1


class ToolSherlock(ToolBase):
    @property
    def tool_id(self) -> str:
        return "sherlock"

    @property
    def name(self) -> str:
        return "Sherlock"

    @property
    def description(self) -> str:
        return "Поиск имени пользователя в сотнях соцсетей."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        username = (params.get("username") or "").strip()
        if not username:
            return {"success": False, "error": "Укажите имя пользователя."}
        if " " in username:
            return {"success": False, "error": "Введите одно имя пользователя без пробелов."}

        timeout = min(max(int(params.get("timeout", 180) or 180), 60), 300)
        out, err, code = _run_sherlock(username, timeout_sec=timeout)
        combined = (out + "\n" + err).strip()
        return {
            "success": code == 0,
            "output": combined or "Нет результатов или ошибка.",
        }
