"""
Инструмент: Фото — офлайн OCR (tesseract).

Требует:
- pip: pytesseract
- system: tesseract-ocr (бинарник в PATH)
"""

from __future__ import annotations

import base64
import io
import os
import re
import shutil
from typing import Any

from PIL import Image

from .base import ToolBase


def _strip_data_url(s: str) -> str:
    s = (s or "").strip()
    if s.startswith("data:"):
        comma = s.find(",")
        if comma != -1:
            return s[comma + 1 :]
    return s


_RE_EMAIL = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
_RE_URL = re.compile(r"\bhttps?://[^\s<>()\"']+\b", re.I)
_RE_PHONE = re.compile(r"\b(?:\+?\d[\d\s().-]{7,}\d)\b")

_TESSERACT_HINT = (
    "Tesseract не найден. Установите пакеты (Debian/Ubuntu/Kali): "
    "sudo apt install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus "
    "или задайте путь: export TESSERACT_CMD=/usr/bin/tesseract"
)


def _resolve_tesseract_cmd() -> str | None:
    """Путь к tesseract: TESSERACT_CMD, PATH, типичные пути Linux/macOS."""
    env = (os.environ.get("TESSERACT_CMD") or "").strip()
    if env and os.path.isfile(env):
        return env
    w = shutil.which("tesseract")
    if w and os.path.isfile(w):
        return w
    for p in (
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
        "/snap/bin/tesseract",
        "/opt/homebrew/bin/tesseract",
    ):
        if os.path.isfile(p):
            return p
    return None


class ToolPhotoOCR(ToolBase):
    @property
    def tool_id(self) -> str:
        return "photo-ocr"

    @property
    def name(self) -> str:
        return "Фото: OCR (офлайн)"

    @property
    def description(self) -> str:
        return "Распознавание текста на изображении (Tesseract)."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            import pytesseract  # noqa: PLC0415
        except Exception as e:
            return {"success": False, "error": f"pytesseract не установлен: {e}"}

        tess = _resolve_tesseract_cmd()
        if not tess:
            return {"success": False, "error": _TESSERACT_HINT}
        pytesseract.pytesseract.tesseract_cmd = tess

        b64 = _strip_data_url(str(params.get("image_base64") or params.get("imageBase64") or ""))
        if not b64:
            return {"success": False, "error": "Передайте image_base64 (data URL или base64)."}
        try:
            raw = base64.b64decode(b64, validate=False)
        except Exception as e:
            return {"success": False, "error": f"base64 decode: {e}"}

        lang = (params.get("lang") or "eng+rus").strip()
        try:
            with Image.open(io.BytesIO(raw)) as img:
                img.load()
                # небольшой хак: OCR лучше на RGB
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                text = pytesseract.image_to_string(img, lang=lang) or ""
        except Exception as e:
            err = str(e).strip()
            if "tesseract" in err.lower() and ("not installed" in err.lower() or "path" in err.lower() or "not found" in err.lower()):
                return {"success": False, "error": f"{_TESSERACT_HINT} (детали: {err})"}
            return {"success": False, "error": f"OCR ошибка: {e}"}

        text_norm = "\n".join([line.rstrip() for line in text.splitlines()]).strip()
        emails = sorted({m.group(0) for m in _RE_EMAIL.finditer(text_norm)})[:80]
        urls = sorted({m.group(0) for m in _RE_URL.finditer(text_norm)})[:80]
        phones = sorted({m.group(0) for m in _RE_PHONE.finditer(text_norm)})[:80]

        return {
            "success": True,
            "fullText": text_norm,
            "emails": emails,
            "urls": urls,
            "phones": phones,
            # эти поля оставляем пустыми — можно улучшать дальше
            "addresses": [],
            "names": [],
            "brands": [],
            "lang": lang,
        }

