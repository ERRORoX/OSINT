import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
import types
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_grabcam_module():
    package_name = "_grabcam_tools_test"
    tools_dir = ROOT / "backend" / "tools"

    package = types.ModuleType(package_name)
    package.__path__ = [str(tools_dir)]
    sys.modules[package_name] = package

    for module_name in ("base", "tool_grabcam"):
        full_name = f"{package_name}.{module_name}"
        spec = importlib.util.spec_from_file_location(full_name, tools_dir / f"{module_name}.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules[full_name] = module
        spec.loader.exec_module(module)

    return sys.modules[f"{package_name}.tool_grabcam"]


class GrabcamRunSafetyTest(unittest.TestCase):
    def test_running_session_does_not_rewrite_payload_or_options(self):
        module = load_grabcam_module()
        original_state = dict(module._state)
        original_find_free_port = module._find_free_port
        original_refresh_payload = module._refresh_payload
        original_options_file = module._OPTIONS_FILE

        with tempfile.TemporaryDirectory() as tmp:
            options_path = Path(tmp) / "options.json"
            options_path.write_text('{"camera": true}\n', encoding="utf-8")

            def fail_find_free_port():
                raise AssertionError("running sessions must be rejected before port selection")

            calls = []
            module._OPTIONS_FILE = str(options_path)
            module._find_free_port = fail_find_free_port
            module._refresh_payload = lambda link: calls.append(link)
            with module._lock:
                module._state.update(
                    {
                        "running": True,
                        "error": None,
                        "method": "php_only",
                        "php_port": 3333,
                        "local_url": "http://127.0.0.1:3333",
                    }
                )

            try:
                result = module.ToolGrabcam().run({"method": "php_only", "camera": False})
            finally:
                module._find_free_port = original_find_free_port
                module._refresh_payload = original_refresh_payload
                module._OPTIONS_FILE = original_options_file
                with module._lock:
                    module._state.clear()
                    module._state.update(original_state)

            self.assertFalse(result["success"])
            self.assertIn("уже запущен", result["error"])
            self.assertEqual([], calls)
            self.assertEqual('{"camera": true}\n', options_path.read_text(encoding="utf-8"))


@unittest.skipIf(shutil.which("php") is None, "php CLI is not installed")
class GrabcamPhpPathSafetyTest(unittest.TestCase):
    def run_php_copy(self, tmp_path, script_name, post_entries):
        shutil.copyfile(ROOT / "tools" / "grabcam" / script_name, tmp_path / script_name)
        runner = tmp_path / "run.php"
        runner.write_text(
            textwrap.dedent(
                f"""\
                <?php
                $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
                $_SERVER['HTTP_USER_AGENT'] = 'unit-test-agent';
                $_POST = {self.php_array(post_entries)};
                include __DIR__ . '/{script_name}';
                ?>
                """
            ),
            encoding="utf-8",
        )
        proc = subprocess.run(
            ["php", str(runner)],
            cwd=tmp_path,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        self.assertEqual(0, proc.returncode, proc.stderr)
        self.assertFalse((tmp_path / "escaped").exists())

    @staticmethod
    def php_array(entries):
        pairs = []
        for key, value in entries.items():
            pairs.append(f"{json.dumps(key)} => {json.dumps(value)}")
        return "array(" + ", ".join(pairs) + ")"

    def test_post_php_keeps_device_and_camera_paths_inside_photo(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            self.run_php_copy(
                tmp_path,
                "post.php",
                {
                    "cat": "data:image/png;base64,WA==",
                    "device_id": "../../escaped",
                    "camera_type": "../../outside",
                },
            )

            photo_dir = tmp_path / "Photo" / "escaped" / "front"
            self.assertTrue(photo_dir.is_dir())
            self.assertTrue(list(photo_dir.glob("cam_front_*.png")))

    def test_location_php_keeps_device_path_inside_photo(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            self.run_php_copy(
                tmp_path,
                "location.php",
                {
                    "device_id": "../../escaped",
                    "location_data": json.dumps({"lat": 1.25, "lon": 2.5}),
                },
            )

            self.assertTrue((tmp_path / "Photo" / "escaped" / "gps_location.txt").is_file())
            self.assertTrue((tmp_path / "Photo" / "escaped" / "geo_info.txt").is_file())


if __name__ == "__main__":
    unittest.main()
