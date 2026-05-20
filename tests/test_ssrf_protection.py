from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path
from unittest import mock


BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import security  # noqa: E402

tools_pkg = types.ModuleType("tools")
tools_pkg.__path__ = [str(BACKEND_DIR / "tools")]
sys.modules.setdefault("tools", tools_pkg)

from tools.tool_photo_ai import ToolPhotoAI  # noqa: E402


class _RedirectResponse:
    is_redirect = True
    is_permanent_redirect = False
    headers = {"Location": "http://127.0.0.1/admin"}
    url = "https://public.example/start"

    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


class SSRFProtectionTests(unittest.TestCase):
    def test_safe_public_get_revalidates_redirect_targets(self) -> None:
        response = _RedirectResponse()

        def host_policy(host: str) -> bool:
            return host == "public.example"

        with mock.patch.object(security, "is_public_host", side_effect=host_policy), mock.patch.object(
            security.requests,
            "get",
            return_value=response,
        ) as get:
            with self.assertRaises(security.PublicURLBlocked) as caught:
                security.safe_public_get("https://public.example/start")

        self.assertEqual(caught.exception.reason, "blocked_host")
        self.assertTrue(response.closed)
        get.assert_called_once()

    def test_photo_ai_rejects_loopback_image_url(self) -> None:
        result = ToolPhotoAI().run({"task": "analysis", "image_url": "http://127.0.0.1/private.jpg"})

        self.assertFalse(result["success"])
        self.assertIn("blocked_host", result["error"])


if __name__ == "__main__":
    unittest.main()
