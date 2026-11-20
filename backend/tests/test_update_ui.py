"""Static regression tests for the system updater UI."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class UpdateUITests(unittest.TestCase):
    def test_update_progress_controls_exist(self):
        source = (ROOT / "static" / "js" / "settings.js").read_text(encoding="utf-8")
        for token in (
            'id="update-progress"',
            'id="update-progress-bar"',
            'id="update-progress-percent"',
            'id="update-elapsed"',
            'id="update-eta"',
        ):
            with self.subTest(token=token):
                self.assertIn(token, source)

    def test_update_ui_polls_backend_job_status(self):
        source = (ROOT / "static" / "js" / "settings.js").read_text(encoding="utf-8")
        self.assertIn("/system/update/status?job_id=", source)
        self.assertIn("data.progress", source)
        self.assertIn("formatDuration(elapsed)", source)
        self.assertIn("data.state === \"completed\"", source)
        self.assertIn("data.state === \"error\"", source)

    def test_backend_exposes_update_job_status(self):
        source = (ROOT / "backend" / "app.py").read_text(encoding="utf-8")
        self.assertIn('@app.route("/api/system/update/status", methods=["GET"])', source)
        self.assertIn("started_at", source)
