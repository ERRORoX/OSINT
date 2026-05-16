import os
import sys
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

import app as backend_app  # noqa: E402


class FakeResponse:
    def __init__(self, status_code, url, headers=None):
        self.status_code = status_code
        self.url = url
        self.headers = headers or {}


class VerifyLinksRedirectTests(unittest.TestCase):
    def test_redirect_to_private_host_is_blocked_before_following(self):
        calls = []

        def fake_get(url, **kwargs):
            calls.append(url)
            if url == "https://public.example/start":
                return FakeResponse(302, url, {"Location": "http://127.0.0.1:5000/private"})
            raise AssertionError(f"unexpected request to {url}")

        with patch.object(backend_app, "_is_public_host", side_effect=lambda host: host == "public.example"):
            with patch.object(backend_app.requests, "get", side_effect=fake_get):
                result = backend_app._verify_one("https://public.example/start")

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "blocked_redirect")
        self.assertEqual(result["redirect_url"], "http://127.0.0.1:5000/private")
        self.assertEqual(calls, ["https://public.example/start"])

    def test_public_redirect_is_followed(self):
        def fake_get(url, **kwargs):
            if url == "https://public.example/start":
                return FakeResponse(302, url, {"Location": "/final"})
            if url == "https://public.example/final":
                return FakeResponse(200, url)
            raise AssertionError(f"unexpected request to {url}")

        with patch.object(backend_app, "_is_public_host", return_value=True):
            with patch.object(backend_app.requests, "get", side_effect=fake_get):
                result = backend_app._verify_one("https://public.example/start")

        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], 200)
        self.assertEqual(result["final_url"], "https://public.example/final")


if __name__ == "__main__":
    unittest.main()
