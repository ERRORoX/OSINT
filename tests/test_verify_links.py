import backend.app as app_module


class DummyResponse:
    def __init__(self, status_code, url, headers=None):
        self.status_code = status_code
        self.url = url
        self.headers = headers or {}


def test_verify_one_blocks_redirect_to_private_host(monkeypatch):
    calls = []

    def fake_is_public_host(host):
        return host == "example.com"

    def fake_get(url, **kwargs):
        calls.append((url, kwargs))
        assert kwargs["allow_redirects"] is False
        return DummyResponse(
            302,
            url,
            {"Location": "http://127.0.0.1:8080/admin"},
        )

    monkeypatch.setattr(app_module, "_is_public_host", fake_is_public_host)
    monkeypatch.setattr(app_module.requests, "get", fake_get)

    result = app_module._verify_one("https://example.com/start")

    assert result["ok"] is False
    assert result["error"] == "blocked_redirect"
    assert result["final_url"] == "http://127.0.0.1:8080/admin"
    assert [call[0] for call in calls] == ["https://example.com/start"]


def test_verify_one_follows_public_redirect(monkeypatch):
    calls = []
    responses = {
        "https://example.com/start": DummyResponse(302, "https://example.com/start", {"Location": "/ok"}),
        "https://example.com/ok": DummyResponse(204, "https://example.com/ok"),
    }

    def fake_is_public_host(host):
        return host == "example.com"

    def fake_get(url, **kwargs):
        calls.append((url, kwargs))
        assert kwargs["allow_redirects"] is False
        return responses[url]

    monkeypatch.setattr(app_module, "_is_public_host", fake_is_public_host)
    monkeypatch.setattr(app_module.requests, "get", fake_get)

    result = app_module._verify_one("https://example.com/start")

    assert result["ok"] is True
    assert result["status"] == 204
    assert result["final_url"] == "https://example.com/ok"
    assert [call[0] for call in calls] == [
        "https://example.com/start",
        "https://example.com/ok",
    ]
