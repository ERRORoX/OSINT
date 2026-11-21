"""Tests for the persistent relationship graph SQLite store."""
import sqlite3
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(BACKEND_DIR))

from db import graph_store


@contextmanager
def _temporary_connection(path):
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


class RelationshipGraphStoreTests(unittest.TestCase):
    def test_merge_is_persistent_and_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                first = graph_store.merge_graph_data({
                    "nodes": [
                        {"id": "domain:root", "type": "domain", "label": "example.org"},
                        {"id": "ip:one", "type": "ip", "label": "203.0.113.10"},
                    ],
                    "edges": [{"source": "domain:root", "target": "ip:one", "label": "DNS A"}],
                })
                self.assertEqual(len(first["nodes"]), 2)
                self.assertEqual(len(first["edges"]), 1)

                second_payload = {
                    "nodes": [
                        {"id": "domain:root", "type": "domain", "label": "example.org"},
                        {"id": "email:one", "type": "email", "label": "admin@example.org"},
                    ],
                    "edges": [{"source": "domain:root", "target": "email:one", "label": "email найден"}],
                }
                merged = graph_store.merge_graph_data(second_payload)
                repeated = graph_store.merge_graph_data(second_payload)
                loaded = graph_store.get_graph_data()

                self.assertEqual(len(merged["nodes"]), 3)
                self.assertEqual(len(merged["edges"]), 2)
                self.assertEqual(len(repeated["nodes"]), 3)
                self.assertEqual(len(repeated["edges"]), 2)
                self.assertEqual(len(loaded["nodes"]), 3)
                self.assertEqual(len(loaded["edges"]), 2)
                self.assertIsNotNone(loaded["updated_at"])

                # Position updates merge into the existing graph instead of replacing it.
                moved = graph_store.merge_graph_data({
                    "nodes": [
                        {"id": "domain:root", "type": "domain", "label": "example.org", "x": 333, "y": 222},
                    ],
                    "edges": [],
                })
                moved_root = next(node for node in moved["nodes"] if node["id"] == "domain:root")
                self.assertEqual(moved_root["x"], 333)
                self.assertEqual(moved_root["y"], 222)
                self.assertEqual(len(moved["nodes"]), 3)

    def test_preserves_wide_graph_coordinates(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                saved = graph_store.replace_graph_data({
                    "nodes": [
                        {"id": "domain:root", "type": "domain", "label": "root.example", "x": 1200, "y": 400},
                        {"id": "ip:far", "type": "ip", "label": "203.0.113.20", "x": 2450, "y": 900},
                    ],
                    "edges": [{"source": "domain:root", "target": "ip:far", "label": "DNS"}],
                })
                positions = {node["id"]: (node["x"], node["y"]) for node in saved["nodes"]}
                self.assertEqual(positions["domain:root"], (1200, 400))
                self.assertEqual(positions["ip:far"], (2450, 900))
                loaded = graph_store.get_graph_data()
                loaded_positions = {node["id"]: (node["x"], node["y"]) for node in loaded["nodes"]}
                self.assertEqual(loaded_positions, positions)

    def test_recovers_legacy_graph_when_investigation_record_exists_without_graph(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                with sqlite3.connect(db_path) as connection:
                    connection.row_factory = sqlite3.Row
                    connection.execute("""
                        CREATE TABLE relationship_graph (
                            id INTEGER PRIMARY KEY CHECK (id = 1),
                            graph_json TEXT NOT NULL,
                            updated_at TEXT NOT NULL
                        )
                    """)
                    connection.execute(
                        "INSERT INTO relationship_graph (id, graph_json, updated_at) VALUES (1, ?, ?)",
                        ('{"nodes":[{"id":"domain:legacy","type":"domain","label":"legacy.example"}],"edges":[]}', "2026-11-20T00:00:00+00:00"),
                    )
                    connection.execute("""
                        CREATE TABLE investigations (
                            id TEXT PRIMARY KEY, name TEXT NOT NULL,
                            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                        )
                    """)
                    connection.execute(
                        "INSERT INTO investigations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                        ("existing-investigation", "Старое расследование", "2026-11-19", "2026-11-19"),
                    )
                    connection.commit()
                graph = graph_store.get_graph_data()
                self.assertEqual([node["id"] for node in graph["nodes"]], ["domain:legacy"])
                self.assertEqual(graph["investigation_id"], "existing-investigation")

    def test_named_investigations_keep_graphs_isolated(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                first = graph_store.list_investigations()
                self.assertEqual(len(first["items"]), 1)
                first_id = first["active_id"]
                graph_store.merge_graph_data({
                    "nodes": [{"id": "domain:first", "type": "domain", "label": "first.example"}],
                    "edges": [],
                })
                second = graph_store.create_investigation("Второе расследование")
                second_id = second["id"]
                self.assertNotEqual(first_id, second_id)
                self.assertEqual(graph_store.get_graph_data()["nodes"], [])
                graph_store.merge_graph_data({
                    "nodes": [{"id": "domain:second", "type": "domain", "label": "second.example"}],
                    "edges": [],
                })
                graph_store.activate_investigation(first_id)
                first_graph = graph_store.get_graph_data()
                self.assertEqual([node["id"] for node in first_graph["nodes"]], ["domain:first"])
                graph_store.rename_investigation(first_id, "Переименованное расследование")
                names = {item["id"]: item["name"] for item in graph_store.list_investigations()["items"]}
                self.assertEqual(names[first_id], "Переименованное расследование")
                graph_store.delete_investigation(second_id)
                remaining = graph_store.list_investigations()
                self.assertEqual(len(remaining["items"]), 1)
                self.assertEqual(remaining["active_id"], first_id)

    def test_preserves_valid_provenance_and_rejects_unsafe_source_urls(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                # Add both endpoints before creating a relationship.
                saved = graph_store.merge_graph_data({
                    "nodes": [
                        {"id": "domain:evidence", "type": "domain", "label": "evidence.example",
                         "provenance": {"source": "Passive DNS", "tool_id": "dnsx",
                                        "source_url": "https://example.org/report",
                                        "observed_at": "2026-11-21T10:00:00Z",
                                        "confidence": 0.875, "evidence": "A record observed"}},
                        {"id": "ip:evidence", "type": "ip", "label": "203.0.113.8"},
                    ],
                    "edges": [{"source": "domain:evidence", "target": "ip:evidence", "label": "DNS A",
                               "provenance": {"source": "DNS response", "source_url": "javascript:alert(1)", "confidence": 5}}],
                })
                node = next(item for item in saved["nodes"] if item["id"] == "domain:evidence")
                edge = saved["edges"][0]
                self.assertEqual(node["provenance"]["source"], "Passive DNS")
                self.assertEqual(node["provenance"]["source_url"], "https://example.org/report")
                self.assertEqual(node["provenance"]["confidence"], 0.875)
                self.assertNotIn("source_url", edge["provenance"])
                self.assertNotIn("confidence", edge["provenance"])
                self.assertEqual(graph_store.get_graph_data()["nodes"][0]["provenance"]["tool_id"], "dnsx")

    def test_investigation_notes_are_persistent_and_isolated(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                first = graph_store.list_investigations()["active_id"]
                note = graph_store.create_investigation_note("Проверить DNS-историю", first)
                self.assertEqual(note["content"], "Проверить DNS-историю")
                self.assertEqual(graph_store.list_investigation_notes(first)["items"][0]["id"], note["id"])
                second = graph_store.create_investigation("Второе дело")["id"]
                self.assertEqual(graph_store.list_investigation_notes(second)["items"], [])
                self.assertEqual(len(graph_store.list_investigation_notes(first)["items"]), 1)
                graph_store.delete_investigation_note(note["id"], first)
                self.assertEqual(graph_store.list_investigation_notes(first)["items"], [])
                with self.assertRaises(ValueError):
                    graph_store.create_investigation_note("   ", first)
                with self.assertRaises(ValueError):
                    graph_store.create_investigation_note("x" * 5001, first)

    def test_accepts_phone_entity_type(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                saved = graph_store.merge_graph_data({
                    "nodes": [{"id": "phone:1", "type": "phone", "label": "+12025550123"}],
                    "edges": [],
                })
                self.assertEqual(saved["nodes"][0]["type"], "phone")

    def test_rejects_unknown_edge_endpoints(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                with self.assertRaises(ValueError):
                    graph_store.replace_graph_data({
                        "nodes": [{"id": "domain:root", "type": "domain", "label": "example.org"}],
                        "edges": [{"source": "domain:root", "target": "ip:missing", "label": "DNS A"}],
                    })

    def test_clear_removes_persisted_graph(self):
        with tempfile.TemporaryDirectory() as directory:
            db_path = str(Path(directory) / "graph.sqlite3")
            with patch.object(graph_store, "get_db", lambda: _temporary_connection(db_path)):
                graph_store.merge_graph_data({
                    "nodes": [{"id": "domain:root", "type": "domain", "label": "example.org"}],
                    "edges": [],
                })
                cleared = graph_store.clear_graph_data()
                loaded = graph_store.get_graph_data()
                self.assertEqual(cleared["nodes"], [])
                self.assertEqual(loaded["nodes"], [])
                self.assertEqual(loaded["edges"], [])


if __name__ == "__main__":
    unittest.main()
