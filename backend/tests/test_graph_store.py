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
