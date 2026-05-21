import os
import sys
import unittest
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

import app as app_module  # noqa: E402


class FakeResponse:
    def __init__(self, status_code, url, headers=None):
        self.status_code = status_code
        self.url = url
        self.headers = headers or {}


def public_dns_only(host, *_args, **_kwargs):
    if host in {"public.example", "cdn.example"}:
        return [(2, 1, 6, "", ("93.184.216.34", 0))]
    raise OSError("blocked test host")


class VerifyLinksSecurityTests(unittest.TestCase):
    def test_private_host_is_blocked_before_request(self):
        with patch.object(app_module.requests, "get") as get:
            result = app_module._verify_one("http://127.0.0.1:5000/api/settings/keys")

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "blocked_host")
        get.assert_not_called()

    def test_redirect_to_private_host_is_blocked(self):
        with (
            patch.object(app_module.socket, "getaddrinfo", side_effect=public_dns_only),
            patch.object(
                app_module.requests,
                "get",
                return_value=FakeResponse(
                    302,
                    "https://public.example/start",
                    {"Location": "http://127.0.0.1:5000/api/settings/keys"},
                ),
            ) as get,
        ):
            result = app_module._verify_one("https://public.example/start")

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "blocked_redirect")
        self.assertEqual(get.call_count, 1)
        self.assertFalse(get.call_args.kwargs["allow_redirects"])

    def test_public_redirect_is_followed(self):
        with (
            patch.object(app_module.socket, "getaddrinfo", side_effect=public_dns_only),
            patch.object(
                app_module.requests,
                "get",
                side_effect=[
                    FakeResponse(302, "https://public.example/start", {"Location": "/next"}),
                    FakeResponse(200, "https://public.example/next"),
                ],
            ) as get,
        ):
            result = app_module._verify_one("https://public.example/start")

        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], 200)
        self.assertEqual(result["final_url"], "https://public.example/next")
        self.assertEqual(get.call_count, 2)


if __name__ == "__main__":
    unittest.main()
