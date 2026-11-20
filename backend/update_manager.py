"""Git updater для development-ветки OSINT Panel 4.2.

Установка сохраняет пользовательские файлы: выполняется только fast-forward merge,
без reset/clean. Перед изменением HEAD создаётся локальная резервная ветка.
"""
from __future__ import annotations

import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REMOTE = "origin"
BRANCH = "feature/panel-4.2-osint-expansion"


class UpdateError(RuntimeError):
    pass


def _git(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(ROOT), *args],
            check=True, capture_output=True, text=True, timeout=180,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as exc:
        detail = getattr(exc, "stderr", "") or str(exc)
        raise UpdateError("Ошибка Git: {}".format(str(detail).strip())) from exc
    return result.stdout.strip()


def check_update() -> dict:
    if not (ROOT / ".git").exists():
        raise UpdateError("Папка проекта не является Git-клоном. Для этой установки автообновление недоступно.")
    _git("fetch", "--quiet", REMOTE, BRANCH)
    current = _git("rev-parse", "HEAD")
    latest = _git("rev-parse", "{}/{}".format(REMOTE, BRANCH))
    behind = int(_git("rev-list", "--count", "HEAD..{}/{}".format(REMOTE, BRANCH)))
    current_branch = _git("branch", "--show-current")
    return {
        "current": current[:12],
        "latest": latest[:12],
        "available": behind > 0,
        "commits_behind": behind,
        "branch": BRANCH,
        "current_branch": current_branch,
        "channel": "development",
        "stable_releases": False,
    }


def install_update() -> dict:
    current_branch = _git("branch", "--show-current")
    if current_branch != BRANCH:
        raise UpdateError(
            "Обновление этой сборки разрешено только из ветки {}. Текущая ветка: {}.".format(
                BRANCH, current_branch or "detached HEAD"
            )
        )

    status = _git("status", "--porcelain")
    if status:
        raise UpdateError(
            "Есть локальные изменения. Обновление остановлено, чтобы не перезаписать ваши файлы. "
            "Сначала сохраните изменения."
        )

    check = check_update()
    if not check["available"]:
        return {"updated": False, "message": "Установлена последняя версия.", **check}

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    backup_branch = "backup/before-update-{}".format(stamp)
    _git("branch", backup_branch, "HEAD")
    try:
        _git("merge", "--ff-only", "{}/{}".format(REMOTE, BRANCH))
    except UpdateError as exc:
        raise UpdateError(
            "Обновление не применено. Исходная версия сохранена в резервной ветке {}. {}".format(
                backup_branch, str(exc)
            )
        ) from exc

    after = check_update()
    return {
        "updated": True,
        "backup_branch": backup_branch,
        "message": "Обновление установлено. Сервер будет автоматически перезапущен.",
        "restart_required": True,
        **after,
    }
