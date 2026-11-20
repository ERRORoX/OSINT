"""
Инструмент Blackbird (p1ngul1n0) — поиск аккаунтов по имени пользователя на 600+ платформах (WhatsMyName).
Запуск Python blackbird.py из tools/blackbird.
"""
import os
import re
import subprocess
import sys
from typing import Any

from tools.base import ToolBase

_ANSI = re.compile(r"\x1b\[[?0-9;]*[a-zA-Z]")
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def _strip_ansi(text: str) -> str:
    return _ANSI.sub("", text)


def _run_blackbird(username: str, timeout_sec: int = 300) -> tuple[str, str, int]:
    username = (username or "").strip()
    if not username or " " in username:
        return "", "Укажите одно имя пользователя без пробелов.", -1

    tool_dir = os.path.join(_ROOT, "tools", "blackbird")
    script = os.path.join(tool_dir, "blackbird.py")
    if not os.path.isfile(script):
        return "", "Blackbird не найден. Ожидается tools/blackbird/blackbird.py", -1

    # Без --no-update: при отсутствии data/wmn-data.json Blackbird скачает список сайтов (checkUpdates).
    cmd = [
        sys.executable,
        script,
        "--username", username,
    ]

    try:
        # Blackbird (вендор) использует смешанные импорты:
        # - sys.path.append(<tool_dir>/src) в самом blackbird.py (модули.*)
        # - некоторые файлы импортируют utils.* (лежит в src/modules/utils)
        # Поэтому добавляем обе директории в PYTHONPATH.
        py_path_parts = [
            tool_dir,
            os.path.join(tool_dir, "src"),
            os.path.join(tool_dir, "src", "modules"),
        ]
        py_path = os.pathsep.join([p for p in py_path_parts if p])
        proc = subprocess.run(
            cmd,
            cwd=tool_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_sec,
            env={**os.environ, "PYTHONPATH": py_path},
        )
        out = _strip_ansi(proc.stdout or "").strip()
        err = _strip_ansi(proc.stderr or "").strip()
        return out, err, proc.returncode
    except subprocess.TimeoutExpired:
        return "", "Превышено время ожидания ({} сек).".format(timeout_sec), -1
    except Exception as e:
        return "", str(e), -1


class ToolBlackbird(ToolBase):
    @property
    def tool_id(self) -> str:
        return "blackbird"

    @property
    def name(self) -> str:
        return "Blackbird"

    @property
    def description(self) -> str:
        return "Поиск аккаунтов по имени пользователя на 600+ платформах (WhatsMyName, p1ngul1n0)."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        username = (params.get("username") or "").strip()
        if not username:
            return {"success": False, "error": "Укажите имя пользователя."}
        if " " in username:
            return {"success": False, "error": "Введите одно имя пользователя без пробелов."}

        timeout = max(60, min(600, int(params.get("timeout", 300) or 300)))
        out, err, code = _run_blackbird(username, timeout_sec=timeout)
        combined = (out + "\n" + err).strip()
        return {
            "success": code == 0 or bool(out),
            "output": combined or err or "Нет результатов или ошибка запуска.",
        }
