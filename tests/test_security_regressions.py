import os
import sys
import types
import importlib.util
import unittest


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def load_formgrab_module():
    """Load only tool_formgrab without importing the full optional tool registry."""
    tools_dir = os.path.join(ROOT, "backend", "tools")
    package_name = "security_regression_tools"
    package = types.ModuleType(package_name)
    package.__path__ = [tools_dir]
    sys.modules[package_name] = package

    for module_name, filename in (("base", "base.py"), ("tool_formgrab", "tool_formgrab.py")):
        full_name = f"{package_name}.{module_name}"
        spec = importlib.util.spec_from_file_location(full_name, os.path.join(tools_dir, filename))
        module = importlib.util.module_from_spec(spec)
        sys.modules[full_name] = module
        assert spec.loader is not None
        spec.loader.exec_module(module)
    return sys.modules[f"{package_name}.tool_formgrab"]


class PhotoAiUrlValidationTests(unittest.TestCase):
    def test_rejects_private_and_local_image_urls(self):
        from backend.photo_ai import validate_image_url_for_ai

        blocked = [
            "http://127.0.0.1/private.png",
            "http://localhost/private.png",
            "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.5/image.jpg",
            "file:///etc/passwd",
        ]

        for url in blocked:
            with self.subTest(url=url):
                self.assertIsNotNone(validate_image_url_for_ai(url))

    def test_allows_data_images_and_public_urls(self):
        from backend.photo_ai import validate_image_url_for_ai

        allowed = [
            "data:image/png;base64,AAAA",
            "https://example.com/image.jpg",
        ]

        for url in allowed:
            with self.subTest(url=url):
                self.assertIsNone(validate_image_url_for_ai(url))


class FormGrabTokenTests(unittest.TestCase):
    def test_unknown_capture_token_is_rejected_without_creating_state(self):
        tool_formgrab = load_formgrab_module()

        token = "missing-token-for-test"
        tool_formgrab._CAPTURES.pop(token, None)

        self.assertFalse(tool_formgrab.add_capture(token, "login", "secret", "127.0.0.1"))
        self.assertNotIn(token, tool_formgrab._CAPTURES)

    def test_known_capture_token_still_records_input(self):
        tool_formgrab = load_formgrab_module()

        token = tool_formgrab.get_or_create_token()
        self.addCleanup(lambda: tool_formgrab._CAPTURES.pop(token, None))

        self.assertTrue(tool_formgrab.add_capture(token, "login", "alice", "127.0.0.1"))
        captures = tool_formgrab.get_captures(token)
        self.assertEqual(captures[0]["field"], "login")
        self.assertEqual(captures[0]["value"], "alice")


if __name__ == "__main__":
    unittest.main()
