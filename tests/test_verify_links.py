from unittest import TestCase, main
from unittest.mock import patch

import backend.url_verify as url_verify


class DummyResponse:
    def __init__(self, status_code, url, headers=None):
        self.status_code = status_code
        self.url = url
        self.headers = headers or {}


class VerifyLinksTest(TestCase):
    def test_verify_one_blocks_redirect_to_private_host(self):
        calls = []

        def fake_is_public_host(host):
            return host == "example.com"

        def fake_get(url, **kwargs):
            calls.append((url, kwargs))
            self.assertIs(kwargs["allow_redirects"], False)
            return DummyResponse(
                302,
                url,
                {"Location": "http://127.0.0.1:8080/admin"},
            )

        with (
            patch.object(url_verify, "is_public_host", fake_is_public_host),
            patch.object(url_verify.requests, "get", fake_get),
        ):
            result = url_verify.verify_one_url("https://example.com/start")

        self.assertIs(result["ok"], False)
        self.assertEqual(result["error"], "blocked_redirect")
        self.assertEqual(result["final_url"], "http://127.0.0.1:8080/admin")
        self.assertEqual([call[0] for call in calls], ["https://example.com/start"])

    def test_verify_one_follows_public_redirect(self):
        calls = []
        responses = {
            "https://example.com/start": DummyResponse(302, "https://example.com/start", {"Location": "/ok"}),
            "https://example.com/ok": DummyResponse(204, "https://example.com/ok"),
        }

        def fake_is_public_host(host):
            return host == "example.com"

        def fake_get(url, **kwargs):
            calls.append((url, kwargs))
            self.assertIs(kwargs["allow_redirects"], False)
            return responses[url]

        with (
            patch.object(url_verify, "is_public_host", fake_is_public_host),
            patch.object(url_verify.requests, "get", fake_get),
        ):
            result = url_verify.verify_one_url("https://example.com/start")

        self.assertIs(result["ok"], True)
        self.assertEqual(result["status"], 204)
        self.assertEqual(result["final_url"], "https://example.com/ok")
        self.assertEqual(
            [call[0] for call in calls],
            [
                "https://example.com/start",
                "https://example.com/ok",
            ],
        )


if __name__ == "__main__":
    main()
