"""
Объединённый инструмент: проверка email через Holehe и h8mail.
Один ввод email — результаты всех проверок в одной панели.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import importlib.util
from pathlib import Path

def _load_helper_class(filename: str, class_name: str, module_name: str):
    helper_path = Path(__file__).resolve().parent / filename
    spec = importlib.util.spec_from_file_location(module_name, helper_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load Google OSINT helper: {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    helper_class = getattr(module, class_name, None)
    if not isinstance(helper_class, type):
        raise TypeError(f"Missing helper class {class_name} in {filename}")
    return helper_class


from tools.base import ToolBase


class ToolGoogleOsint(ToolBase):
    @property
    def tool_id(self) -> str:
        return "google-osint"

    @property
    def name(self) -> str:
        return "Google OSINT"

    @property
    def description(self) -> str:
        return "Проверка email: регистрации на сайтах (Holehe) и утечки (h8mail). Один ввод — оба отчёта в одной панели."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        email = (params.get("email") or "").strip()
        run_holehe = bool(params.get("run_holehe", True))
        run_h8mail = bool(params.get("run_h8mail", True))

        if not email or "@" not in email:
            return {"success": False, "error": "Укажите email."}
        if not run_holehe and not run_h8mail:
            return {"success": False, "error": "Включите хотя бы один инструмент (Holehe или h8mail)."}

        ToolHolehe = _load_helper_class("holehe.py", "ToolHolehe", "_osint_google_holehe")
        ToolH8mail = _load_helper_class("h8mail.py", "ToolH8mail", "_osint_google_h8mail")

        # Определяем наличие API ключей для h8mail, чтобы подсказать в UI.
        hunter_key = (os.environ.get("TH_HUNTER_KEY") or os.environ.get("H8MAIL_HUNTER_KEY") or "").strip()
        hibp_key = (os.environ.get("H8MAIL_HIBP") or "").strip()
        h8mail_keys_present = bool(hunter_key or hibp_key)

        results: dict[str, dict[str, Any]] = {
            "holehe": {"success": False, "output": "(пропущен)", "stats": {"duration_ms": 0}},
            "h8mail": {"success": False, "output": "(пропущен)", "stats": {"duration_ms": 0}, "keys_present": h8mail_keys_present},
        }

        def _run_one(kind: str) -> tuple[str, dict[str, Any]]:
            t0 = time.perf_counter()
            if kind == "holehe":
                r = ToolHolehe().run({"email": email, "only_used": True})
            else:
                r = ToolH8mail().run({"email": email, "skip_defaults": False})
            elapsed = int((time.perf_counter() - t0) * 1000)
            out = (r.get("output") or r.get("error") or "").strip()
            payload = {
                "success": bool(r.get("success", False)),
                "output": out,
                "stats": {"duration_ms": elapsed, "returncode": r.get("returncode")},
            }
            if kind == "h8mail":
                payload["keys_present"] = h8mail_keys_present
            return kind, payload

        to_run = []
        if run_holehe:
            to_run.append("holehe")
        if run_h8mail:
            to_run.append("h8mail")

        # Параллельный запуск: Holehe и h8mail независимы.
        if to_run:
            with ThreadPoolExecutor(max_workers=min(2, len(to_run))) as ex:
                futs = [ex.submit(_run_one, k) for k in to_run]
                for f in as_completed(futs):
                    k, payload = f.result()
                    results[k] = payload

        any_ok = any(results[k].get("success") for k in results.keys())
        return {
            "success": any_ok,
            "results": results,
        }
