"""Evidence Center storage for public-source investigation artifacts."""
import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from .database import get_db

MAX_ITEMS = 2000


def _ensure(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS investigation_evidence (
            id TEXT PRIMARY KEY,
            investigation_id TEXT,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            domain TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT '',
            snippet TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            sha256 TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)


def _clean_text(value, limit):
    return str(value or "").strip()[:limit]


def list_evidence(investigation_id=None):
    with get_db() as conn:
        _ensure(conn)
        if investigation_id:
            rows = conn.execute(
                "SELECT * FROM investigation_evidence WHERE investigation_id = ? ORDER BY created_at DESC LIMIT ?",
                (investigation_id, MAX_ITEMS),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM investigation_evidence ORDER BY created_at DESC LIMIT ?",
                (MAX_ITEMS,),
            ).fetchall()
        return {"items": [dict(row) for row in rows], "count": len(rows)}


def create_evidence(data):
    if not isinstance(data, dict):
        raise ValueError("Ожидается JSON-объект материала.")
    title = _clean_text(data.get("title"), 240)
    url = _clean_text(data.get("url"), 2000)
    parsed = urlparse(url)
    if not title:
        raise ValueError("Укажи название материала.")
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Источник должен быть публичной HTTP(S)-ссылкой.")
    domain = (parsed.hostname or "").lower()[:255]
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    item_id = uuid.uuid4().hex
    snippet = _clean_text(data.get("snippet"), 4000)
    notes = _clean_text(data.get("notes"), 4000)
    source = _clean_text(data.get("source"), 160)
    sha256 = _clean_text(data.get("sha256"), 64).lower()
    if sha256 and not re.fullmatch(r"[a-f0-9]{64}", sha256):
        raise ValueError("SHA-256 должен содержать 64 шестнадцатеричных символа.")
    investigation_id = _clean_text(data.get("investigation_id"), 80) or None
    with get_db() as conn:
        _ensure(conn)
        if investigation_id:
            exists = conn.execute("SELECT id FROM investigations WHERE id = ?", (investigation_id,)).fetchone()
            if not exists:
                raise ValueError("Расследование не найдено.")
        conn.execute(
            """INSERT INTO investigation_evidence
               (id, investigation_id, title, url, domain, source, snippet, notes, sha256, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (item_id, investigation_id, title, url, domain, source, snippet, notes, sha256, now, now),
        )
    return {"id": item_id, "title": title, "url": url, "domain": domain, "source": source,
            "snippet": snippet, "notes": notes, "sha256": sha256,
            "investigation_id": investigation_id, "created_at": now, "updated_at": now}


def update_evidence(item_id, data):
    if not isinstance(data, dict):
        raise ValueError("Ожидается JSON-объект.")
    notes = _clean_text(data.get("notes"), 4000)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_db() as conn:
        _ensure(conn)
        result = conn.execute(
            "UPDATE investigation_evidence SET notes = ?, updated_at = ? WHERE id = ?",
            (notes, now, item_id),
        )
        if not result.rowcount:
            raise ValueError("Материал не найден.")
        row = conn.execute("SELECT * FROM investigation_evidence WHERE id = ?", (item_id,)).fetchone()
        return dict(row)


def delete_evidence(item_id):
    with get_db() as conn:
        _ensure(conn)
        result = conn.execute("DELETE FROM investigation_evidence WHERE id = ?", (item_id,))
        if not result.rowcount:
            raise ValueError("Материал не найден.")
    return {"deleted": True, "id": item_id}
