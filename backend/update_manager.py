"""Безопасная проверка и установка обновлений OSINT Panel из официальной ветки Git."""
from __future__ import annotations

import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REMOTE = "origin"
BRANCH = "feature/panel-4.1-redesign"


class UpdateError(RuntimeError):
    pass


def _git(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(ROOT), *args],
            check=True, capture_output=True, text=True, timeout=120,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as exc:
        detail = getattr(exc, "stderr", "") or str(exc)
        raise UpdateError(f"Git operation failed: {detail.strip()}") from exc
    return result.stdout.strip()


def check_update() -> dict:
    if not (ROOT / ".git").exists():
        raise UpdateError("Папка проекта не является Git-клоном. Автообновление недоступно.")
    _git("fetch", "--quiet", REMOTE, BRANCH)
    current = _git("rev-parse", "HEAD")
    latest = _git("rev-parse", f"{REMOTE}/{BRANCH}")
    behind = int(_git("rev-list", "--count", f"HEAD..{REMOTE}/{BRANCH}"))
    return {
        "current": current[:12],
        "latest": latest[:12],
        "available": behind > 0,
        "commits_behind": behind,
        "branch": BRANCH,
    }


def install_update() -> dict:
    current_branch = _git("branch", "--show-current")
    if current_branch != BRANCH:
        raise UpdateError(
            f"Установка разрешена только из ветки {BRANCH}; сейчас активна ветка {current_branch or 'detached HEAD'}."
        )
    status = _git("status", "--porcelain")
    if status:
        raise UpdateError(
            "Обнаружены локальные изменения. Сначала сохраните их или сделайте резервную копию; "
            "обновление остановлено, чтобы не перезаписать ваши файлы."
        )

    check = check_update()
    if not check["available"]:
        return {"updated": False, "message": "Установлена последняя версия.", **check}

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_branch = f"backup/before-update-{stamp}"
    _git("branch", backup_branch, "HEAD")
    _git("merge", "--ff-only", f"{REMOTE}/{BRANCH}")

    return {
        "updated": True,
        "backup_branch": backup_branch,
        "message": "Обновление установлено. Перезапустите OSINT Panel.",
        "restart_required": True,
        **check_update(),
    }
