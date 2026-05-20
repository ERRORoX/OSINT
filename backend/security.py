"""
Shared network safety helpers for endpoints that fetch user-supplied URLs.
"""

from __future__ import annotations

import base64
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import requests


class PublicURLBlocked(ValueError):
    """Raised when a user-supplied URL is not safe for server-side fetching."""

    def __init__(self, reason: str, url: str = "") -> None:
        super().__init__(reason)
        self.reason = reason
        self.url = url


def is_public_host(host: str) -> bool:
    """Return True only for hosts that resolve exclusively to globally routable IPs."""
    if not host:
        return False
    h = host.strip().lower().rstrip(".")
    if h in {"localhost", "localhost.localdomain"}:
        return False

    try:
        ip = ipaddress.ip_address(h)
        return _is_public_ip(ip)
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(h, None)
    except OSError:
        return False

    if not infos:
        return False

    for info in infos:
        addr = info[4][0]
        try:
            if not _is_public_ip(ipaddress.ip_address(addr)):
                return False
        except ValueError:
            return False
    return True


def validate_public_http_url(url: str) -> tuple[bool, str]:
    """Validate that a URL is http(s) and points to a public host."""
    u = (url or "").strip()
    parsed = urlparse(u)
    if parsed.scheme not in {"http", "https"}:
        return False, "bad_scheme"
    if not parsed.hostname:
        return False, "bad_host"
    if not is_public_host(parsed.hostname):
        return False, "blocked_host"
    return True, ""


def safe_public_get(
    url: str,
    *,
    timeout_sec: float = 6.0,
    max_redirects: int = 5,
    headers: dict[str, str] | None = None,
    stream: bool = False,
) -> requests.Response:
    """GET a public http(s) URL, validating every redirect target before following it."""
    current_url = (url or "").strip()
    for redirect_count in range(max_redirects + 1):
        ok, reason = validate_public_http_url(current_url)
        if not ok:
            raise PublicURLBlocked(reason, current_url)

        response = requests.get(
            current_url,
            timeout=timeout_sec,
            allow_redirects=False,
            headers=headers,
            stream=stream,
        )
        if not (response.is_redirect or response.is_permanent_redirect):
            return response

        location = (response.headers.get("Location") or "").strip()
        if not location:
            return response

        next_url = urljoin(current_url, location)
        response.close()
        ok, reason = validate_public_http_url(next_url)
        if not ok:
            raise PublicURLBlocked(reason, next_url)
        if redirect_count >= max_redirects:
            raise PublicURLBlocked("too_many_redirects", next_url)
        current_url = next_url

    raise PublicURLBlocked("too_many_redirects", current_url)


def safe_fetch_public_url_as_data_url(
    url: str,
    *,
    timeout_sec: float = 15.0,
    max_bytes: int = 10 * 1024 * 1024,
    user_agent: str = "OSINT-Panel/1.0",
) -> str:
    """Fetch a public image URL through the SSRF guard and return it as a data URL."""
    response = safe_public_get(
        url,
        timeout_sec=timeout_sec,
        headers={"User-Agent": user_agent},
        stream=True,
    )
    try:
        response.raise_for_status()
        content_type = (response.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
        if content_type and not (content_type.startswith("image/") or content_type == "application/octet-stream"):
            raise PublicURLBlocked("not_image", getattr(response, "url", url) or url)

        chunks: list[bytes] = []
        total = 0
        for chunk in response.iter_content(chunk_size=64 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > max_bytes:
                raise PublicURLBlocked("too_large", getattr(response, "url", url) or url)
            chunks.append(chunk)
        if not chunks:
            raise PublicURLBlocked("empty_response", getattr(response, "url", url) or url)

        media_type = content_type or "image/jpeg"
        encoded = base64.b64encode(b"".join(chunks)).decode("ascii")
        return f"data:{media_type};base64,{encoded}"
    finally:
        response.close()


def _is_public_ip(ip: ipaddress._BaseAddress) -> bool:
    return bool(
        ip.is_global
        and not ip.is_private
        and not ip.is_loopback
        and not ip.is_link_local
        and not ip.is_multicast
        and not ip.is_reserved
        and not ip.is_unspecified
    )
