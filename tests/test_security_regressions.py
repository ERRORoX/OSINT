import os
import sys
from unittest.mock import patch


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

import app as app_module  # noqa: E402
from settings_keys import is_safe_ollama_url  # noqa: E402
from tools.tool_photo_ai import ToolPhotoAI  # noqa: E402


class FakeResponse:
    def __init__(self, status_code, headers=None, body=b""):
        self.status_code = status_code
        self.headers = headers or {}
        self._body = body

    def iter_content(self, chunk_size=65536):
        yield self._body

    def close(self):
        pass


def test_verify_links_blocks_redirect_to_private_host_before_following():
    calls = []

    def fake_get(url, **kwargs):
        calls.append((url, kwargs))
        assert url == "https://example.test/start"
        assert kwargs["allow_redirects"] is False
        return FakeResponse(302, {"Location": "http://127.0.0.1:8000/admin"})

    with patch.object(app_module, "_is_public_host", side_effect=lambda host: host == "example.test"):
        with patch.object(app_module.requests, "get", side_effect=fake_get):
            result = app_module._verify_one("https://example.test/start")

    assert result["ok"] is False
    assert result["error"] == "blocked_host"
    assert result["final_url"] == "http://127.0.0.1:8000/admin"
    assert len(calls) == 1


def test_photo_ai_endpoint_rejects_private_image_url_before_tool_run():
    client = app_module.app.test_client()

    with patch.object(app_module, "run_tool") as run_tool:
        response = client.post("/api/analyze", json={"imageUrl": "http://127.0.0.1:5000/private.png"})

    assert response.status_code == 400
    assert response.get_json()["success"] is False
    run_tool.assert_not_called()


def test_photo_ai_tool_rejects_unchecked_remote_url():
    result = ToolPhotoAI().run({"task": "analysis", "image_url": "http://127.0.0.1/private.png"})

    assert result["success"] is False
    assert "data:image" in result["error"]


def test_ollama_url_validation_allows_only_standard_loopback_endpoint():
    assert is_safe_ollama_url("http://localhost:11434/v1")
    assert is_safe_ollama_url("http://127.0.0.1:11434")
    assert not is_safe_ollama_url("http://127.0.0.1:6379")
    assert not is_safe_ollama_url("http://169.254.169.254:11434/v1")
    assert not is_safe_ollama_url("http://192.168.1.5:11434/v1")
