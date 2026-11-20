"""Persistent relationship graph storage backed by the panel's SQLite database."""
import json
import re
from datetime import datetime, timezone

from .database import get_db

_ALLOWED_TYPES = {"person", "domain", "ip", "email", "organization"}
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
            "x": max(25, min(730, x)) if x else None,
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


def _read_graph(conn):
    _ensure_table(conn)
    row = conn.execute(
        "SELECT graph_json, updated_at FROM relationship_graph WHERE id = 1"
    ).fetchone()
    if not row:
        return {"nodes": [], "edges": [], "updated_at": None}
    try:
        graph = json.loads(row["graph_json"])
    except (TypeError, ValueError):
        graph = {"nodes": [], "edges": []}
    return {
        "nodes": graph.get("nodes", []) if isinstance(graph, dict) else [],
        "edges": graph.get("edges", []) if isinstance(graph, dict) else [],
        "updated_at": row["updated_at"],
    }


def get_graph_data():
    with get_db() as conn:
        return _read_graph(conn)


def _write_graph(conn, graph):
    updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    stored = {"nodes": graph["nodes"], "edges": graph["edges"]}
    conn.execute(
        """INSERT INTO relationship_graph (id, graph_json, updated_at)
           VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET graph_json = excluded.graph_json,
                                         updated_at = excluded.updated_at""",
        (json.dumps(stored, ensure_ascii=False), updated_at),
    )
    return {**stored, "updated_at": updated_at}


def merge_graph_data(payload):
    incoming = validate_graph_payload(payload)
    with get_db() as conn:
        current = _read_graph(conn)
        nodes_by_id = {node["id"]: dict(node) for node in current["nodes"]}
        for node in incoming["nodes"]:
            old = nodes_by_id.get(node["id"])
            if old:
                old["label"] = node["label"]
                if node["details"]:
                    old["details"] = node["details"]
                if node["x"] is not None:
                    old["x"] = node["x"]
                if node["y"] is not None:
                    old["y"] = node["y"]
            else:
                position = len(nodes_by_id)
                node["x"] = node["x"] or 50 + (position % 8) * 94
                node["y"] = node["y"] or 55 + (position // 8) * 95
                nodes_by_id[node["id"]] = node

        edges = list(current["edges"])
        edge_keys = {(e["source"], e["target"], e.get("label", "Связь")) for e in edges}
        for edge in incoming["edges"]:
            if edge["source"] not in nodes_by_id or edge["target"] not in nodes_by_id:
                raise ValueError("Связь ссылается на узел, которого нет в графе.")
            key = (edge["source"], edge["target"], edge["label"])
            if key not in edge_keys:
                edges.append(edge)
                edge_keys.add(key)

        nodes = list(nodes_by_id.values())
        if len(nodes) > _MAX_NODES or len(edges) > _MAX_EDGES:
            raise ValueError("После объединения превышен лимит графа.")
        return _write_graph(conn, {"nodes": nodes, "edges": edges})


def replace_graph_data(payload):
    graph = validate_graph_payload(payload)
    ids = {node["id"] for node in graph["nodes"]}
    if any(edge["source"] not in ids or edge["target"] not in ids for edge in graph["edges"]):
        raise ValueError("Связь ссылается на неизвестный узел.")
    with get_db() as conn:
        nodes = []
        for index, node in enumerate(graph["nodes"]):
            node["x"] = node["x"] or 50 + (index % 8) * 94
            node["y"] = node["y"] or 55 + (index // 8) * 95
            nodes.append(node)
        return _write_graph(conn, {"nodes": nodes, "edges": graph["edges"]})


def clear_graph_data():
    with get_db() as conn:
        _ensure_table(conn)
        conn.execute("DELETE FROM relationship_graph WHERE id = 1")
    return {"nodes": [], "edges": [], "updated_at": None}
