"""
ИИ-помощник для OSINT/Pentest в стиле Automation Agent.
Поддержка: OpenAI API, OpenRouter, Ollama (локально, OpenAI-совместимый endpoint).
Режимы: чат, подсказки, автономное выполнение (агент сам запускает инструменты по цели).
"""
import json
import os
import re
import urllib.request
import urllib.error
from typing import Any

# Ключи из .env (загружаются через load_env_into_os при старте)
def _get(key: str, default: str = "") -> str:
    return (os.environ.get(key) or "").strip() or default


# Системный промпт агента OSINT/Pentest
SYSTEM_PROMPT = """Ты — ИИ-помощник в панели OSINT (разведка в открытых источниках) и пентеста.
Твоя задача: помогать пользователю планировать и проводить разведку и тестирование.

Доступные разделы и инструменты панели:
- Поиск по домену: информация о домене (WHOIS, DNS, SSL, crt.sh), theHarvester (email, поддомены), Shodan, Subfinder, dnsx
- Поиск по имени пользователя: Sherlock, Maigret, Social-Analyzer, Blackbird (поиск аккаунтов по нику/email на 600+ сайтах)
- Google OSINT: поиск по email
- Прочие: AnonSMS, Instagram Bruter, Grabcam и др.

Отвечай кратко и по делу, на русском языке.
Когда пользователь описывает цель (домен, ник, email) или показывает результаты — предлагай конкретные следующие шаги: какие инструменты запустить, в каком порядке, на что обратить внимание.
Не придумывай инструменты, которых нет в списке выше. Не давай инструкций по взлому или незаконным действиям."""

# Промпт для автономного режима: агент возвращает ACTION или DONE
AUTONOMOUS_SYSTEM = """Ты — автономный агент панели OSINT. Твоя задача: по цели пользователя сам выбирать и запускать инструменты панели по очереди, пока не соберёшь достаточно данных, затем выдать итог.

Доступные инструменты (tool_id и типичные параметры):
- domain-search: {"domain": "example.com"} — WHOIS, DNS, SSL, поддомены crt.sh
- theharvester: {"domain": "example.com", "limit": 100} — email, поддомены, хосты
- shodan: {"domain": "example.com"} или {"query": "apache"} или {"ip": "1.2.3.4"}
- subfinder: {"domain": "example.com"} — пассивный поиск поддоменов
- dnsx: {"domain": "example.com"} — DNS A/AAAA/CNAME
- sherlock: {"username": "nick"} — поиск ника в соцсетях
- maigret: {"username": "nick"} — расширенный поиск по сайтам
- blackbird: {"username": "nick"} — 600+ сайтов по нику/email
- google-osint: {"email": "user@example.com"} — проверка email (Holehe, h8mail)

Формат ответа — СТРОГО один из двух вариантов:

1) Чтобы запустить инструмент, напиши ровно:
ACTION: <tool_id>
PARAMS: <валидный JSON, один объект>

2) Чтобы закончить и выдать итог, напиши:
DONE: <краткая сводка по результатам для пользователя на русском>

Из цели пользователя извлекай домен (example.com), ник (username), email и подставляй в параметры. За один ответ — только один ACTION или один DONE. После каждого инструмента ты получишь результат и сможешь решить: запустить следующий или выдать DONE.

ВАЖНО — не путать домен и ник:
- Если цель — домен (например imei.tj, example.com), используй ТОЛЬКО инструменты с параметром domain: domain-search, theharvester, shodan, subfinder, dnsx. НЕ запускай sherlock/maigret/blackbird с частью домена как username (imei из imei.tj — это не ник).
- Если цель — ник пользователя (username), используй sherlock, maigret, blackbird с параметром username.
После результатов: если заметил ошибку (неверный параметр, пустой вывод) — сам запусти правильный инструмент. Действуй самостоятельно, не спрашивай пользователя."""

# Промпт для чата с возможностью запуска инструментов (агент сам запускает по запросу пользователя)
CHAT_WITH_TOOLS_SYSTEM = """Ты — ИИ-помощник панели OSINT. Ты МОЖЕШЬ сам запускать инструменты. Когда пользователь просит разведку или говорит "давай" — запускай нужные инструменты. Ты также должен САМ находить и исправлять свои ошибки: если запустил не тот инструмент или с неверными параметрами — следующим шагом запусти правильный, не спрашивая пользователя.

Строго различай цель:
- Цель = ДОМЕН (например imei.tj, example.com) → только инструменты с параметром domain: domain-search, theharvester, shodan, subfinder, dnsx. Параметр всегда полный домен, например {"domain": "imei.tj"}. НЕ запускай sherlock/maigret/blackbird для домена — часть домена (например "imei") это НЕ ник пользователя.
- Цель = НИК/username (например johndoe) → sherlock, maigret, blackbird с {"username": "johndoe"}.
- Цель = email → theharvester (domain из email), google-osint, blackbird.

Инструменты (ACTION + PARAMS):
- domain-search: {"domain": "example.com"}
- theharvester: {"domain": "example.com", "limit": 100}
- shodan: {"domain": "example.com"} или {"query": "..."} или {"ip": "1.2.3.4"}
- subfinder: {"domain": "example.com"}
- dnsx: {"domain": "example.com"}
- sherlock: {"username": "nick"} — только когда цель именно ник/username
- maigret: {"username": "nick"}
- blackbird: {"username": "nick"}
- google-osint: {"email": "user@example.com"}

Формат ответа: чтобы запустить инструмент — строго одна строка ACTION: <tool_id> и строка PARAMS: <JSON>. Чтобы ответить текстом — пиши без ACTION и PARAMS.

После результата инструмента: если видишь, что параметр был неверный (например для домена imei.tj запустил sherlock(imei)) или результат пустой/ошибка — следующим сообщением запусти правильный инструмент сам. Отвечай на русском."""


def _call_openai_compatible(
    messages: list[dict[str, str]],
    *,
    base_url: str,
    api_key: str,
    model: str,
    max_tokens: int = 1500,
    timeout: int = 90,
) -> tuple[str | None, str | None]:
    """
    Вызов OpenAI-совместимого API. Возвращает (content, error).
    При успехе: (text, None). При ошибке: (None, "описание ошибки").
    """
    url = base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.6,
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
            raw = r.read().decode()
            out = json.loads(raw)
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode()
            err_json = json.loads(err_body)
            msg = err_json.get("error", {}).get("message") or err_json.get("message") or err_body[:200]
        except Exception:
            msg = e.reason or f"HTTP {e.code}"
        err_msg = f"HTTP {e.code}: {msg}"
        if e.code == 401 and "openrouter" in base_url.lower():
            err_msg += (
                " У OpenRouter это значит: ключ не найден или отозван. Зайдите на https://openrouter.ai/keys, "
                "войдите в аккаунт, создайте новый ключ (Create key) и подставьте его в настройки. Старый ключ удалите."
            )
        return (None, err_msg)
    except urllib.error.URLError as e:
        reason = str(e.reason) if e.reason else "нет связи"
        if "timed out" in reason.lower() or "timeout" in reason.lower():
            return (None, "Таймаут запроса к ИИ. Увеличьте время или проверьте, что Ollama/сервер запущен.")
        return (None, f"Сеть: {reason}")
    except TimeoutError:
        return (None, "Таймаут запроса к ИИ (увеличьте время или проверьте сервер).")
    except json.JSONDecodeError as e:
        return (None, f"Ответ ИИ не JSON: {e!s}")
    except OSError as e:
        return (None, f"Ошибка: {e!s}")
    try:
        text = (out.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        return (text if text else None, None)
    except (IndexError, TypeError):
        return (None, "Неверный формат ответа ИИ (нет choices[].message.content).")


def _get_ai_config() -> dict[str, Any]:
    """Определяет провайдер и параметры: Ollama, OpenRouter или OpenAI."""
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
    return {
        "provider": "openai",
        "base_url": base.rstrip("/"),
        "api_key": api_key,
        "model": model,
    }


def is_ai_available() -> bool:
    """Есть ли настроенный провайдер ИИ (Ollama, OpenRouter или OpenAI)."""
    if _get("OLLAMA_URL"):
        return True
    rk = _get("OPENROUTER_API_KEY") or _get("OPENROUTER_KEY")
    if rk and len(rk) >= 20:
        return True
    return bool(_get("AI_OPENAI_API_KEY") or _get("OPENAI_API_KEY"))


def chat(user_message: str, context: str = "", history: list[dict[str, str]] | None = None) -> dict[str, Any]:
    """
    Диалог с агентом. context — описание текущей задачи/результатов (домен, инструмент, вывод).
    history — список { role, content } для многократного обмена.
    """
    if not is_ai_available():
        return {"success": False, "error": "ИИ не настроен. Укажите OLLAMA_URL, OPENROUTER_API_KEY или AI_OPENAI_API_KEY в настройках (API ключи)."}
    cfg = _get_ai_config()
    system = SYSTEM_PROMPT
    if context:
        system += f"\n\nТекущий контекст от пользователя:\n{context[:4000]}"
    messages = [{"role": "system", "content": system}]
    if history:
        for h in history[-20:]:  # последние 20 сообщений
            role = (h.get("role") or "user")
            if role not in ("system", "user", "assistant"):
                role = "user"
            messages.append({"role": role, "content": (h.get("content") or "")[:8000]})
    messages.append({"role": "user", "content": user_message[:8000]})
    text, err = _call_openai_compatible(
        messages,
        base_url=cfg["base_url"],
        api_key=cfg["api_key"],
        model=cfg["model"],
    )
    if err:
        return {"success": False, "error": f"ИИ ({cfg['provider']}): {err}"}
    if not text:
        return {"success": False, "error": "ИИ вернул пустой ответ."}
    return {"success": True, "reply": text, "provider": cfg["provider"]}


def suggest_next_steps(context: str) -> dict[str, Any]:
    """
    Подсказки «что делать дальше» по контексту (например: «Домен example.com, запущены theHarvester и Subfinder, найдено 10 поддоменов»).
    """
    user_msg = (
        "Дай краткий список из 3–6 следующих шагов: какие инструменты панели запустить, в каком порядке, зачем. "
        "Только нумерованный список. Инструменты: поиск по домену (domain-search, theHarvester, Shodan, Subfinder, dnsx), "
        "поиск по имени (Sherlock, Maigret, Social-Analyzer, Blackbird), Google OSINT.\n\nКонтекст:\n"
        + (context or "(нет контекста)")[:3000]
    )
    return chat(user_msg, history=[])


def chat_with_tools(
    user_message: str,
    context: str = "",
    history: list[dict[str, str]] | None = None,
    run_tool_fn: callable = None,
    max_tool_steps: int = 15,
) -> dict[str, Any]:
    """
    Чат, в котором ИИ может сам запускать инструменты. При ответе в формате ACTION/PARAMS
    вызывается run_tool_fn(tool_id, params), результат передаётся обратно ИИ. Цикл до max_tool_steps.
    run_tool_fn(tool_id, params) -> dict с success, output, error.
    """
    if not is_ai_available():
        return {"success": False, "error": "ИИ не настроен. Укажите OLLAMA_URL, OPENROUTER_API_KEY или AI_OPENAI_API_KEY в настройках."}
    if not callable(run_tool_fn):
        return {"success": False, "error": "Не передан обработчик запуска инструментов."}
    cfg = _get_ai_config()
    system = CHAT_WITH_TOOLS_SYSTEM
    if context:
        system += f"\n\nКонтекст пользователя:\n{context[:3000]}"
    messages = [{"role": "system", "content": system}]
    for h in (history or [])[-15:]:
        role = (h.get("role") or "user")
        if role not in ("system", "user", "assistant"):
            role = "user"
        messages.append({"role": role, "content": (h.get("content") or "")[:6000]})
    messages.append({"role": "user", "content": user_message[:6000]})
    tool_runs: list[dict[str, Any]] = []
    last_reply = ""
    for _ in range(max_tool_steps):
        text, err = _call_openai_compatible(
            messages,
            base_url=cfg["base_url"],
            api_key=cfg["api_key"],
            model=cfg["model"],
            max_tokens=1200,
            timeout=90,
        )
        if err:
            return {"success": False, "error": f"ИИ ({cfg['provider']}): {err}", "tool_runs": tool_runs}
        if not text:
            break
        parsed = _parse_agent_response(text)
        if parsed is None:
            last_reply = text
            break
        if parsed.get("done"):
            last_reply = parsed.get("summary") or text
            break
        tool_id = (parsed.get("tool_id") or "").strip()
        params = parsed.get("params") or {}
        if not tool_id:
            last_reply = text
            break
        result = run_tool_fn(tool_id, params)
        success = bool(result.get("success"))
        output = (result.get("output") or result.get("error") or "")[:2500]
        tool_runs.append({
            "tool_id": tool_id,
            "params": params,
            "success": success,
            "output_preview": output,
        })
        tool_result_msg = f"Результат инструмента {tool_id}: {'успех' if success else 'ошибка'}.\nВывод:\n{output}"
        messages.append({"role": "assistant", "content": text})
        messages.append({"role": "user", "content": tool_result_msg})
        last_reply = text
    if not last_reply and tool_runs:
        last_reply = f"Выполнено шагов: {len(tool_runs)}. Результаты выше."
    return {
        "success": True,
        "reply": last_reply,
        "tool_runs": tool_runs,
        "provider": cfg["provider"],
    }


def _extract_json_object(s: str) -> dict[str, Any]:
    """Извлекает первый валидный JSON-объект из строки (для PARAMS)."""
    start = s.find("{")
    if start == -1:
        return {}
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    raw = s[start : i + 1]
                    # заменить single quotes на double для совместимости с некоторыми моделями
                    if "'" in raw and '"' not in raw:
                        raw = raw.replace("'", '"')
                    return json.loads(raw)
                except json.JSONDecodeError:
                    pass
                return {}
    return {}


def _parse_agent_response(text: str) -> dict[str, Any] | None:
    """
    Парсит ответ агента. Возвращает:
    - {"done": True, "summary": "..."} при DONE:
    - {"done": False, "tool_id": "...", "params": {...}} при ACTION:
    - None при ошибке разбора
    """
    if not text or not isinstance(text, str):
        return None
    text = text.strip()
    # DONE: сводка (до конца блока или до следующего ключевого слова)
    done_m = re.search(r"DONE:\s*(.+?)(?=\n(?:ACTION:|NEXT_TOOL:)|$)", text, re.DOTALL | re.IGNORECASE)
    if done_m:
        summary = done_m.group(1).strip()
        return {"done": True, "summary": summary[:4000]}
    # ACTION: tool_id или NEXT_TOOL: tool_id, затем PARAMS: json
    action_m = re.search(r"(?:ACTION|NEXT_TOOL):\s*(\w[\w-]*)\s*(?:\n|$)", text, re.IGNORECASE)
    if not action_m:
        return None
    tool_id = action_m.group(1).strip().lower()
    params = {}
    params_section = re.search(r"PARAMS:\s*(.+)", text, re.DOTALL | re.IGNORECASE)
    if params_section:
        params = _extract_json_object(params_section.group(1).strip())
    return {"done": False, "tool_id": tool_id, "params": params}


def get_next_action(goal: str, state: dict[str, Any]) -> dict[str, Any]:
    """
    Запрос к ИИ: следующий шаг по цели и текущему состоянию.
    state: { "steps": [ {"tool_id", "params", "success", "output_preview"} ], "goal": goal }
    Возвращает результат _parse_agent_response или {"done": True, "summary": "Ошибка: ..."} при сбое.
    """
    if not is_ai_available():
        return {"done": True, "summary": "ИИ не настроен. Укажите OLLAMA_URL или AI_OPENAI_API_KEY в настройках."}
    steps = state.get("steps") or []
    context_parts = [f"Цель: {goal}"]
    for i, s in enumerate(steps, 1):
        status = "успех" if s.get("success") else "ошибка"
        out = (s.get("output_preview") or s.get("error") or "")[:1200]
        context_parts.append(f"Шаг {i}: {s.get('tool_id')} ({status}). Вывод: {out}")
    user_msg = "Текущее состояние:\n" + "\n\n".join(context_parts) + "\n\nЧто делать дальше? Ответь строго в формате ACTION: tool_id и PARAMS: {...} или DONE: сводка."
    cfg = _get_ai_config()
    messages = [
        {"role": "system", "content": AUTONOMOUS_SYSTEM},
        {"role": "user", "content": user_msg[:6000]},
    ]
    text, err = _call_openai_compatible(
        messages,
        base_url=cfg["base_url"],
        api_key=cfg["api_key"],
        model=cfg["model"],
        max_tokens=800,
        timeout=90,
    )
    if err:
        return {"done": True, "summary": f"Ошибка ИИ ({cfg['provider']}): {err}"}
    if not text:
        return {"done": True, "summary": "ИИ вернул пустой ответ. Проверьте модель и провайдер."}
    parsed = _parse_agent_response(text)
    if parsed is None:
        return {"done": True, "summary": f"ИИ вернул ответ в неверном формате. Ожидается ACTION/PARAMS или DONE. Ответ: {text[:500]}..."}
    return parsed
