"""
Инструмент Social Analyzer (qeeqbox) — поиск профилей по имени пользователя на 900+ сайтах.
Запуск Python app.py из tools/social-analyzer.
"""
import json
import os
import importlib.util
import re
import subprocess
import sys
from typing import Any

from tools.base import ToolBase

_ANSI = re.compile(r"\x1b\[[?0-9;]*[a-zA-Z]")
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def _strip_ansi(text: str) -> str:
    return _ANSI.sub("", text)


def _ensure_social_analyzer(timeout_sec: int = 900) -> tuple[bool, str]:
    """Install Social Analyzer's Python requirements into the panel interpreter."""
    tool_dir = os.path.join(_ROOT, "tools", "social-analyzer")
    requirements = os.path.join(tool_dir, "requirements.txt")
    if not os.path.isfile(requirements):
        return False, "Не найден tools/social-analyzer/requirements.txt."
    modules = ("bs4", "tld", "termcolor", "langdetect", "requests", "lxml", "galeodes")
    missing = [name for name in modules if importlib.util.find_spec(name) is None]
    if not missing:
        return True, ""
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "-r", requirements],
            cwd=tool_dir, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout_sec,
        )
        if proc.returncode != 0:
            return False, (proc.stderr or proc.stdout or "Не удалось установить зависимости Social Analyzer")[-5000:]
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "Установка Social Analyzer превысила 15 минут."
    except Exception as exc:
        return False, str(exc)


def _run_social_analyzer(username: str, timeout_sec: int = 300) -> tuple[str, str, int]:
    username = (username or "").strip()
    if not username or " " in username:
        return "", "Укажите одно имя пользователя без пробелов.", -1

    tool_dir = os.path.join(_ROOT, "tools", "social-analyzer")
    app_py = os.path.join(tool_dir, "app.py")
    if not os.path.isfile(app_py):
        return "", "Social Analyzer не найден. Ожидается tools/social-analyzer/app.py", -1

    ready, install_error = _ensure_social_analyzer()
    if not ready:
        return "", "Не удалось автоматически установить зависимости Social Analyzer:\\n" + install_error, -1

    cmd = [
        sys.executable, app_py, "--username", username,
        "--websites", "all", "--mode", "fast", "--output", "json",
        "--filter", "good", "--profiles", "detected",
    ]
    try:
        proc = subprocess.run(
            cmd, cwd=tool_dir, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout_sec,
            env={key: value for key, value in os.environ.items() if key != "PYTHONPATH"},
        )
        out = _strip_ansi(proc.stdout or "").strip()
        err = _strip_ansi(proc.stderr or "").strip()
        return out, err, proc.returncode
    except subprocess.TimeoutExpired:
        return "", "Превышено время ожидания ({} сек). Уменьшите число сайтов или увеличьте таймаут.".format(timeout_sec), -1
    except Exception as exc:
        return "", str(exc), -1


def _format_result(json_str: str, err: str) -> str:
    """Преобразует JSON-ответ в читаемый текст для вывода в панели."""
    if not json_str:
        return err or "Нет вывода."
    try:
        data = json.loads(json_str)
        lines = []
        if isinstance(data, dict) and "detected" in data and data["detected"]:
            lines.append("=== Найденные профили ===")
            for item in data["detected"]:
                if isinstance(item, dict):
                    link = item.get("link") or item.get("url") or ""
                    rate = item.get("rate", "")
                    title = (item.get("title") or "")[:80]
                    if link:
                        lines.append("  {}".format(link))
                    if rate:
                        lines.append("    Оценка: {}".format(rate))
                    if title:
                        lines.append("    Заголовок: {}...".format(title) if len(title) >= 80 else "    Заголовок: {}".format(title))
                    lines.append("")
            if "unknown" in data and data["unknown"]:
                lines.append("=== Неопределённые ===")
                for item in data["unknown"][:20]:
                    if isinstance(item, dict) and item.get("link"):
                        lines.append("  {}".format(item["link"]))
                if len(data["unknown"]) > 20:
                    lines.append("  ... и ещё {}".format(len(data["unknown"]) - 20))
        else:
            lines.append(json_str[:50000] if len(json_str) > 50000 else json_str)
            if len(json_str) > 50000:
                lines.append("\n... (вывод обрезан)")
        return "\n".join(lines) if lines else (json_str[:2000] or err or "Нет данных.")
    except json.JSONDecodeError:
        return json_str[:20000] if len(json_str) > 20000 else (json_str or err)


class ToolSocialAnalyzer(ToolBase):
    @property
    def tool_id(self) -> str:
        return "social-analyzer"

    @property
    def name(self) -> str:
        return "Social Analyzer"

    @property
    def description(self) -> str:
        return "Поиск профиля по имени пользователя на 900+ соцсетях и сайтах (qeeqbox)."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        username = (params.get("username") or "").strip()
        if not username:
            return {"success": False, "error": "Укажите имя пользователя."}
        if " " in username:
            return {"success": False, "error": "Введите одно имя пользователя без пробелов."}

        timeout = max(60, min(600, int(params.get("timeout", 300) or 300)))
        out, err, code = _run_social_analyzer(username, timeout_sec=timeout)
        combined = _format_result(out, err)
        return {
            "success": code == 0 or bool(out),
            "output": combined or err or "Нет результатов или ошибка запуска.",
        }
