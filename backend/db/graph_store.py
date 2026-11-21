"""Persistent relationship graph storage backed by the panel's SQLite database."""
import json
import re
from datetime import datetime, timezone

from .database import get_db

_ALLOWED_TYPES = {"person", "domain", "ip", "email", "organization", "phone"}
_ID_RE = re.compile(r"^[a-zA-Z0-9:_-]{1,80}$")
_MAX_NODES = 1000
_MAX_EDGES = 3000


def _ensure_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS relationship_graph (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            graph_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS investigations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS investigation_graphs (
            investigation_id TEXT PRIMARY KEY REFERENCES investigations(id) ON DELETE CASCADE,
            graph_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS investigation_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            active_investigation_id TEXT
        )
    """)
    # Migrate the legacy single graph into a named investigation once.
    count = conn.execute("SELECT COUNT(*) AS total FROM investigations").fetchone()["total"]
    if not count:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        legacy = conn.execute(
            "SELECT graph_json, updated_at FROM relationship_graph WHERE id = 1"
        ).fetchone()
        import uuid
        investigation_id = uuid.uuid4().hex
        conn.execute(
            "INSERT INTO investigations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (investigation_id, "Моё расследование", now, now),
        )
        graph_json = legacy["graph_json"] if legacy else json.dumps({"nodes": [], "edges": []})
        graph_updated = legacy["updated_at"] if legacy else now
        conn.execute(
            "INSERT INTO investigation_graphs (investigation_id, graph_json, updated_at) VALUES (?, ?, ?)",
            (investigation_id, graph_json, graph_updated),
        )
        conn.execute(
            "INSERT INTO investigation_settings (id, active_investigation_id) VALUES (1, ?)"
            " ON CONFLICT(id) DO UPDATE SET active_investigation_id = excluded.active_investigation_id",
            (investigation_id,),
        )
    else:
        # Recover legacy graph data if an earlier interrupted migration created
        # an empty investigation before copying the original graph.
        legacy = conn.execute(
            "SELECT graph_json, updated_at FROM relationship_graph WHERE id = 1"
        ).fetchone()
        if legacy:
            try:
                legacy_graph = json.loads(legacy["graph_json"])
            except (TypeError, ValueError):
                legacy_graph = {}
            legacy_has_data = bool(legacy_graph.get("nodes") or legacy_graph.get("edges")) if isinstance(legacy_graph, dict) else False
            existing_count = conn.execute(
                "SELECT COUNT(*) AS total FROM investigation_graphs"
            ).fetchone()["total"]
            if legacy_has_data and not existing_count:
                target = conn.execute(
                    "SELECT id FROM investigations ORDER BY created_at, id LIMIT 1"
                ).fetchone()
                if target:
                    conn.execute(
                        "INSERT INTO investigation_graphs (investigation_id, graph_json, updated_at) VALUES (?, ?, ?)",
                        (target["id"], legacy["graph_json"], legacy["updated_at"]),
                    )
        active = conn.execute(
            "SELECT active_investigation_id FROM investigation_settings WHERE id = 1"
        ).fetchone()
        if not active or not active["active_investigation_id"]:
            first = conn.execute("SELECT id FROM investigations ORDER BY created_at, id LIMIT 1").fetchone()
            if first:
                conn.execute(
                    "INSERT INTO investigation_settings (id, active_investigation_id) VALUES (1, ?)"
                    " ON CONFLICT(id) DO UPDATE SET active_investigation_id = excluded.active_investigation_id",
                    (first["id"],),
                )
        conn.execute("""
            INSERT OR IGNORE INTO investigation_graphs (investigation_id, graph_json, updated_at)
            SELECT id, ?, updated_at FROM investigations
        """, (json.dumps({"nodes": [], "edges": []}),))


def _active_investigation_id(conn):
    _ensure_table(conn)
    row = conn.execute(
        "SELECT active_investigation_id FROM investigation_settings WHERE id = 1"
    ).fetchone()
    return row["active_investigation_id"] if row else None


def _read_graph(conn, investigation_id=None):
    _ensure_table(conn)
    target = investigation_id or _active_investigation_id(conn)
    row = conn.execute(
        "SELECT graph_json, updated_at FROM investigation_graphs WHERE investigation_id = ?",
        (target,),
    ).fetchone()
    if not row:
        return {"nodes": [], "edges": [], "updated_at": None, "investigation_id": target}
    try:
        graph = json.loads(row["graph_json"])
    except (TypeError, ValueError):
        graph = {"nodes": [], "edges": []}
    return {
        "nodes": graph.get("nodes", []) if isinstance(graph, dict) else [],
        "edges": graph.get("edges", []) if isinstance(graph, dict) else [],
        "updated_at": row["updated_at"],
        "investigation_id": target,
    }


def list_investigations():
    with get_db() as conn:
        _ensure_table(conn)
        active_id = _active_investigation_id(conn)
        rows = conn.execute("""
            SELECT i.id, i.name, i.created_at, i.updated_at,
                   COALESCE(json_array_length(g.graph_json, '$.nodes'), 0) AS node_count,
                   COALESCE(json_array_length(g.graph_json, '$.edges'), 0) AS edge_count
            FROM investigations i
            LEFT JOIN investigation_graphs g ON g.investigation_id = i.id
            ORDER BY i.updated_at DESC, i.created_at DESC
        """).fetchall()
        return {
            "active_id": active_id,
            "items": [{
                "id": row["id"], "name": row["name"],
                "created_at": row["created_at"], "updated_at": row["updated_at"],
                "node_count": row["node_count"], "edge_count": row["edge_count"],
            } for row in rows],
        }


def create_investigation(name):
    import uuid
    clean_name = str(name or "").strip()
    if not clean_name or len(clean_name) > 100:
        raise ValueError("Название расследования должно содержать 1–100 символов.")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    investigation_id = uuid.uuid4().hex
    with get_db() as conn:
        _ensure_table(conn)
        conn.execute(
            "INSERT INTO investigations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (investigation_id, clean_name, now, now),
        )
        conn.execute(
            "INSERT INTO investigation_graphs (investigation_id, graph_json, updated_at) VALUES (?, ?, ?)",
            (investigation_id, json.dumps({"nodes": [], "edges": []}), now),
        )
        conn.execute(
            "UPDATE investigation_settings SET active_investigation_id = ? WHERE id = 1",
            (investigation_id,),
        )
        return {"id": investigation_id, "name": clean_name, "created_at": now, "updated_at": now,
                "node_count": 0, "edge_count": 0, "active_id": investigation_id}


def activate_investigation(investigation_id):
    with get_db() as conn:
        _ensure_table(conn)
        exists = conn.execute("SELECT id FROM investigations WHERE id = ?", (investigation_id,)).fetchone()
        if not exists:
            raise ValueError("Расследование не найдено.")
        conn.execute("UPDATE investigation_settings SET active_investigation_id = ? WHERE id = 1", (investigation_id,))
        return _read_graph(conn, investigation_id)


def rename_investigation(investigation_id, name):
    clean_name = str(name or "").strip()
    if not clean_name or len(clean_name) > 100:
        raise ValueError("Название расследования должно содержать 1–100 символов.")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_db() as conn:
        _ensure_table(conn)
        result = conn.execute(
            "UPDATE investigations SET name = ?, updated_at = ? WHERE id = ?",
            (clean_name, now, investigation_id),
        )
        if not result.rowcount:
            raise ValueError("Расследование не найдено.")
        return {"id": investigation_id, "name": clean_name, "updated_at": now}


def delete_investigation(investigation_id):
    with get_db() as conn:
        _ensure_table(conn)
        ids = [row["id"] for row in conn.execute("SELECT id FROM investigations ORDER BY created_at, id").fetchall()]
        if investigation_id not in ids:
            raise ValueError("Расследование не найдено.")
        if len(ids) <= 1:
            raise ValueError("Нельзя удалить последнее расследование. Создайте другое перед удалением.")
        conn.execute("DELETE FROM investigation_graphs WHERE investigation_id = ?", (investigation_id,))
        conn.execute("DELETE FROM investigations WHERE id = ?", (investigation_id,))
        active_id = _active_investigation_id(conn)
        if active_id == investigation_id:
            next_id = next(item for item in ids if item != investigation_id)
            conn.execute("UPDATE investigation_settings SET active_investigation_id = ? WHERE id = 1", (next_id,))
        return {"deleted_id": investigation_id, "active_id": _active_investigation_id(conn)}


def _touch_investigation(conn, investigation_id, updated_at):
    conn.execute("UPDATE investigations SET updated_at = ? WHERE id = ?", (updated_at, investigation_id))

def validate_graph_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("Ожидается JSON-объект с nodes и edges.")
    raw_nodes = payload.get("nodes")
    raw_edges = payload.get("edges")
    if not isinstance(raw_nodes, list) or not isinstance(raw_edges, list):
        raise ValueError("Поля nodes и edges должны быть массивами.")
    if len(raw_nodes) > _MAX_NODES or len(raw_edges) > _MAX_EDGES:
        raise ValueError("Превышен лимит графа: 1000 узлов и 3000 связей.")

    nodes = []
    seen = set()
    for index, raw in enumerate(raw_nodes):
        if not isinstance(raw, dict):
            raise ValueError(f"Некорректный узел №{index + 1}.")
        node_id = str(raw.get("id") or "").strip()
        kind = str(raw.get("type") or "").strip().lower()
        label = str(raw.get("label") or "").strip()
        if not _ID_RE.fullmatch(node_id):
            raise ValueError(f"Некорректный id узла №{index + 1}.")
        if node_id in seen:
            raise ValueError(f"Повторяющийся id узла: {node_id}.")
        if kind not in _ALLOWED_TYPES:
            raise ValueError(f"Недопустимый тип узла: {kind}.")
        if not label or len(label) > 180:
            raise ValueError(f"Название узла №{index + 1} должно содержать 1–180 символов.")
        seen.add(node_id)
        try:
            x = float(raw.get("x", 0))
            y = float(raw.get("y", 0))
        except (TypeError, ValueError):
            x, y = 0, 0
        nodes.append({
            "id": node_id,
            "type": kind,
            "label": label,
            "details": str(raw.get("details") or "")[:1200],
            "x": max(-100000, min(100000, x)) if x else None,
            "y": max(25, min(12000, y)) if y else None,
        })

    edges = []
    edge_seen = set()
    for index, raw in enumerate(raw_edges):
        if not isinstance(raw, dict):
            raise ValueError(f"Некорректная связь №{index + 1}.")
        source = str(raw.get("source") or "").strip()
        target = str(raw.get("target") or "").strip()
        label = str(raw.get("label") or "Связь").strip()[:100]
        if not source or not target or source == target:
            raise ValueError(f"Некорректные концы связи №{index + 1}.")
        key = (source, target, label)
        if key not in edge_seen:
            edge_seen.add(key)
            edges.append({"source": source, "target": target, "label": label or "Связь"})
    return {"nodes": nodes, "edges": edges}


def get_graph_data(investigation_id=None):
    with get_db() as conn:
        return _read_graph(conn, investigation_id)


def _write_graph(conn, graph, investigation_id=None):
    target = investigation_id or _active_investigation_id(conn)
    if not target:
        raise ValueError("Нет активного расследования.")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    stored = {"nodes": graph["nodes"], "edges": graph["edges"]}
    result = conn.execute(
        """INSERT INTO investigation_graphs (investigation_id, graph_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(investigation_id) DO UPDATE SET graph_json = excluded.graph_json,
                                                       updated_at = excluded.updated_at""",
        (target, json.dumps(stored, ensure_ascii=False), now),
    )
    _touch_investigation(conn, target, now)
    return {**stored, "updated_at": now, "investigation_id": target}


def _node_identity(node):
    """Return a stable, type-aware identity used to collapse duplicate entities."""
    kind = str(node.get("type") or "").strip().lower()
    label = str(node.get("label") or "").strip().casefold()
    if kind == "domain":
        label = label.rstrip(".")
        if label.startswith("www."):
            label = label[4:]
    elif kind == "email":
        label = label.strip()
    return kind, label


def _merge_node_details(existing, incoming):
    """Preserve distinct provenance/details without repeating identical text."""
    parts = []
    for value in (existing, incoming):
        for line in str(value or "").splitlines():
            clean = line.strip()
            if clean and clean not in parts:
                parts.append(clean)
    return "\\n".join(parts)[:1200]


def merge_graph_data(payload, investigation_id=None):
    incoming = validate_graph_payload(payload)
    with get_db() as conn:
        current = _read_graph(conn, investigation_id)

        # First collapse duplicates already stored in the investigation. This
        # also repairs graphs created by older versions of the panel.
        nodes_by_id = {}
        id_map = {}
        identity_to_id = {}
        for raw in current["nodes"]:
            node = dict(raw)
            identity = _node_identity(node)
            canonical_id = identity_to_id.get(identity)
            if canonical_id:
                canonical = nodes_by_id[canonical_id]
                canonical["details"] = _merge_node_details(canonical.get("details"), node.get("details"))
                id_map[node["id"]] = canonical_id
            else:
                identity_to_id[identity] = node["id"]
                nodes_by_id[node["id"]] = node
                id_map[node["id"]] = node["id"]

        # Merge incoming nodes by semantic identity, not only by generated ID.
        for node in incoming["nodes"]:
            identity = _node_identity(node)
            canonical_id = identity_to_id.get(identity)
            if canonical_id:
                old = nodes_by_id[canonical_id]
                old["details"] = _merge_node_details(old.get("details"), node.get("details"))
                if node["label"] and len(node["label"]) > len(old.get("label", "")):
                    old["label"] = node["label"]
                if node["x"] is not None:
                    old["x"] = node["x"]
                if node["y"] is not None:
                    old["y"] = node["y"]
                id_map[node["id"]] = canonical_id
            else:
                position = len(nodes_by_id)
                node["x"] = node["x"] or 50 + (position % 8) * 94
                node["y"] = node["y"] or 55 + (position // 8) * 95
                nodes_by_id[node["id"]] = node
                identity_to_id[identity] = node["id"]
                id_map[node["id"]] = node["id"]

        # Remap old and incoming edges to canonical nodes and deduplicate them.
        edges = []
        edge_keys = set()
        for edge in list(current["edges"]) + incoming["edges"]:
            source = id_map.get(edge["source"], edge["source"])
            target = id_map.get(edge["target"], edge["target"])
            if source == target:
                continue
            if source not in nodes_by_id or target not in nodes_by_id:
                raise ValueError("Связь ссылается на узел, которого нет в графе.")
            label = str(edge.get("label") or "Связь").strip() or "Связь"
            key = (source, target, label.casefold())
            if key not in edge_keys:
                edges.append({"source": source, "target": target, "label": label})
                edge_keys.add(key)

        nodes = list(nodes_by_id.values())
        if len(nodes) > _MAX_NODES or len(edges) > _MAX_EDGES:
            raise ValueError("После объединения превышен лимит графа.")
        return _write_graph(conn, {"nodes": nodes, "edges": edges}, current["investigation_id"])


def replace_graph_data(payload, investigation_id=None):
    graph = validate_graph_payload(payload)
    ids = {node["id"] for node in graph["nodes"]}
    if any(edge["source"] not in ids or edge["target"] not in ids for edge in graph["edges"]):
        raise ValueError("Связь ссылается на неизвестный узел.")
    with get_db() as conn:
        current = _read_graph(conn, investigation_id)
        nodes = []
        for index, node in enumerate(graph["nodes"]):
            node["x"] = node["x"] or 50 + (index % 8) * 94
            node["y"] = node["y"] or 55 + (index // 8) * 95
            nodes.append(node)
        return _write_graph(conn, {"nodes": nodes, "edges": graph["edges"]}, current["investigation_id"])


def clear_graph_data(investigation_id=None):
    with get_db() as conn:
        current = _read_graph(conn, investigation_id)
        return _write_graph(conn, {"nodes": [], "edges": []}, current["investigation_id"])
