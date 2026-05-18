"""
Vision/AI для страницы Фото (/photo/).

Поддержка провайдеров такая же, как у backend/ai_agent.py:
- Ollama (OpenAI-compatible endpoint): OLLAMA_URL (+ OLLAMA_MODEL)
- OpenRouter: OPENROUTER_API_KEY (+ OPENROUTER_MODEL)
- OpenAI-compatible: AI_OPENAI_API_KEY (+ OPENAI_BASE_URL, AI_OPENAI_MODEL)

Важно: этот модуль умеет передавать изображение в формате image_url (data URL или обычный URL).
"""

from __future__ import annotations

import json
import os
import re
import ipaddress
import socket
import urllib.error
import urllib.request
from urllib.parse import urlparse
from typing import Any


def _get(key: str, default: str = "") -> str:
    return (os.environ.get(key) or "").strip() or default


def get_ai_config() -> dict[str, Any]:
    ollama_url = _get("OLLAMA_URL")
    if ollama_url:
        return {
            "provider": "ollama",
            "base_url": ollama_url.rstrip("/"),
            "api_key": "ollama",
            "model": _get("OLLAMA_MODEL", "llama3.2"),
        }
    openrouter_key = _get("OPENROUTER_API_KEY") or _get("OPENROUTER_KEY")
    if openrouter_key and len(openrouter_key) >= 20:
        return {
            "provider": "openrouter",
            "base_url": "https://openrouter.ai/api/v1",
            "api_key": openrouter_key,
            "model": _get("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
        }
    api_key = _get("AI_OPENAI_API_KEY") or _get("OPENAI_API_KEY")
    base = _get("OPENAI_BASE_URL") or "https://api.openai.com/v1"
    model = _get("AI_OPENAI_MODEL", "gpt-4o-mini")
    return {"provider": "openai", "base_url": base.rstrip("/"), "api_key": api_key, "model": model}


def is_ai_available() -> bool:
    if _get("OLLAMA_URL"):
        return True
    rk = _get("OPENROUTER_API_KEY") or _get("OPENROUTER_KEY")
    if rk and len(rk) >= 20:
        return True
    return bool(_get("AI_OPENAI_API_KEY") or _get("OPENAI_API_KEY"))


def _is_public_host(host: str) -> bool:
    """Reject hosts that could make the vision provider fetch internal resources."""
    if not host:
        return False
    h = host.strip().lower()
    if h in {"localhost", "localhost.localdomain"}:
        return False
    try:
        ip = ipaddress.ip_address(h)
        return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved)
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(h, None)
    except OSError:
        return False
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return False
    return True


def validate_image_url_for_ai(image_url: str) -> str | None:
    """Return an error string when a user-supplied image reference is unsafe."""
    value = (image_url or "").strip()
    if not value:
        return "image_url обязателен."
    if value.startswith("data:image/"):
        return None
    parsed = urlparse(value)
    if not parsed.scheme:
        return None
    if parsed.scheme not in {"http", "https"}:
        return "URL изображения должен быть http(s) или data:image."
    if not parsed.netloc or not _is_public_host(parsed.hostname or ""):
        return "URL изображения указывает на локальный или приватный адрес."
    return None


def _call_openai_compatible_vision(
    *,
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    image_url: str,
    max_tokens: int = 1600,
    timeout: int = 120,
) -> tuple[str | None, str | None]:
    """
    OpenAI-compatible Vision call (chat/completions).
    Возвращает (text, error).
    """
    url = base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Ты — модуль анализа изображений для OSINT панели. "
                    "Отвечай на русском. Если просят JSON — верни строго JSON без пояснений."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt[:12000]},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            },
        ],
        "max_tokens": int(max_tokens),
        "temperature": 0.4,
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}" if api_key else "Bearer ollama",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", errors="replace")
            out = json.loads(raw)
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8", errors="replace")
            err_json = json.loads(err_body)
            msg = err_json.get("error", {}).get("message") or err_json.get("message") or err_body[:240]
        except Exception:
            msg = e.reason or f"HTTP {e.code}"
        return (None, f"HTTP {e.code}: {msg}")
    except urllib.error.URLError as e:
        return (None, f"Сеть: {e.reason}")
    except TimeoutError:
        return (None, "Таймаут запроса к ИИ.")
    except json.JSONDecodeError as e:
        return (None, f"Ответ ИИ не JSON: {e!s}")
    except OSError as e:
        return (None, f"Ошибка: {e!s}")
    try:
        text = (out.get("choices") or [{}])[0].get("message", {}).get("content", "")
        text = (text or "").strip()
        return (text if text else None, None)
    except (IndexError, TypeError):
        return (None, "Неверный формат ответа ИИ (нет choices[].message.content).")


_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*([\s\S]*?)\s*```$", re.I)
_OPENROUTER_AFFORD_RE = re.compile(r"can only afford\s+(\d+)", re.I)


def _strip_json_fence(s: str) -> str:
    s = (s or "").strip()
    m = _JSON_FENCE_RE.match(s)
    if m:
        return (m.group(1) or "").strip()
    return s


def analyze_image_json(*, prompt: str, image_url: str, max_tokens: int = 1600) -> dict[str, Any]:
    """
    Просит модель вернуть СТРОГО JSON, пытается распарсить.
    """
    unsafe_reason = validate_image_url_for_ai(image_url)
    if unsafe_reason:
        return {"success": False, "error": unsafe_reason}
    if not is_ai_available():
        return {
            "success": False,
            "error": "ИИ не настроен. Укажите OLLAMA_URL, OPENROUTER_API_KEY или AI_OPENAI_API_KEY в настройках (API ключи).",
        }
    cfg = get_ai_config()
    # Авто-адаптация под OpenRouter credits: при HTTP 402 повторяем с меньшим max_tokens.
    tries = [int(max_tokens)]
    text = None
    err = None
    for i, mt in enumerate(tries):
        text, err = _call_openai_compatible_vision(
            base_url=cfg["base_url"],
            api_key=cfg["api_key"],
            model=cfg["model"],
            prompt=prompt,
            image_url=image_url,
            max_tokens=mt,
        )
        if not err:
            break
        # OpenRouter: "can only afford N" → повторяем с N-32 (минимум 128)
        if i == 0 and "HTTP 402" in err:
            m = _OPENROUTER_AFFORD_RE.search(err)
            if m:
                afford = int(m.group(1))
                mt2 = max(128, min(mt, afford - 32))
                if mt2 < mt:
                    tries.append(mt2)
                    continue
        break
    if err:
        return {"success": False, "error": f"ИИ ({cfg['provider']}): {err}"}
    if not text:
        return {"success": False, "error": "ИИ вернул пустой ответ."}
    raw = _strip_json_fence(text)
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            data.setdefault("success", True)
            data.setdefault("provider", cfg["provider"])
            return data
        return {"success": False, "error": "ИИ вернул не объект JSON.", "raw": raw[:2000]}
    except json.JSONDecodeError:
        return {"success": False, "error": "ИИ вернул невалидный JSON.", "raw": text[:3000]}

