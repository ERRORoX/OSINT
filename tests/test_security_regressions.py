import os
import sys
import unittest


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


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
        from backend.tools import tool_formgrab

        token = "missing-token-for-test"
        tool_formgrab._CAPTURES.pop(token, None)

        self.assertFalse(tool_formgrab.add_capture(token, "login", "secret", "127.0.0.1"))
        self.assertNotIn(token, tool_formgrab._CAPTURES)

    def test_known_capture_token_still_records_input(self):
        from backend.tools import tool_formgrab

        token = tool_formgrab.get_or_create_token()
        self.addCleanup(lambda: tool_formgrab._CAPTURES.pop(token, None))

        self.assertTrue(tool_formgrab.add_capture(token, "login", "alice", "127.0.0.1"))
        captures = tool_formgrab.get_captures(token)
        self.assertEqual(captures[0]["field"], "login")
        self.assertEqual(captures[0]["value"], "alice")


if __name__ == "__main__":
    unittest.main()
