import ipaddress
import socket
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests


_VERIFY_REDIRECT_STATUS_CODES = {301, 302, 303, 307, 308}
_VERIFY_MAX_REDIRECTS = 5


def is_public_host(host: str) -> bool:
    """SSRF защита: запрещаем локальные/приватные адреса и localhost."""
    if not host:
        return False
    h = host.strip().lower()
    if h in {"localhost", "localhost.localdomain"}:
        return False
    try:
        ip = ipaddress.ip_address(h)
        return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved)
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(h, None)
    except OSError:
        return False
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
                return False
        except ValueError:
            continue
    return True


def _validate_public_http_url(url: str) -> tuple[bool, str | None]:
    p = urlparse(url)
    if p.scheme not in {"http", "https"}:
        return False, "bad_scheme"
    if not is_public_host(p.hostname or ""):
        return False, "blocked_host"
    return True, None


def verify_one_url(url: str, timeout_sec: float = 6.0) -> dict:
    u = (url or "").strip()
    try:
        is_valid, error = _validate_public_http_url(u)
        if not is_valid:
            return {"url": u, "ok": False, "error": error}
        t0 = datetime.now().timestamp()
        current_url = u
        redirects = 0
        while True:
            r = requests.get(
                current_url,
                timeout=timeout_sec,
                allow_redirects=False,
                headers={"User-Agent": "OSINT-Panel/1.0"},
            )
            code = int(getattr(r, "status_code", 0) or 0)
            location = r.headers.get("Location") if hasattr(r, "headers") else None
            if code not in _VERIFY_REDIRECT_STATUS_CODES or not location:
                break
            if redirects >= _VERIFY_MAX_REDIRECTS:
                ms = int((datetime.now().timestamp() - t0) * 1000)
                return {
                    "url": u,
                    "ok": False,
                    "status": code,
                    "final_url": current_url,
                    "latency_ms": ms,
                    "error": "too_many_redirects",
                }
            next_url = urljoin(current_url, location)
            is_valid, error = _validate_public_http_url(next_url)
            if not is_valid:
                ms = int((datetime.now().timestamp() - t0) * 1000)
                return {
                    "url": u,
                    "ok": False,
                    "status": code,
                    "final_url": next_url,
                    "latency_ms": ms,
                    "error": "blocked_redirect" if error == "blocked_host" else error,
                }
            current_url = next_url
            redirects += 1
        ms = int((datetime.now().timestamp() - t0) * 1000)
        final = str(getattr(r, "url", current_url) or current_url)
        ok = 200 <= code < 400
        hint = "ok" if ok else ("blocked" if code in {401, 403, 429} else "not_found" if code == 404 else "http_error")
        return {"url": u, "ok": ok, "status": code, "final_url": final, "latency_ms": ms, "hint": hint}
    except requests.Timeout:
        return {"url": u, "ok": False, "error": "timeout"}
    except requests.RequestException as e:
        return {"url": u, "ok": False, "error": "request_error", "detail": str(e)[:200]}
    except Exception as e:
        return {"url": u, "ok": False, "error": "error", "detail": str(e)[:200]}
