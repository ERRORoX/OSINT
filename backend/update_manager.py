"""Git updater для development-ветки OSINT Panel 4.2.

Локальные tracked/untracked изменения автоматически убираются во временный stash,
обновление выполняется fast-forward, затем изменения восстанавливаются. Stash
не удаляется, если восстановление завершилось конфликтом.
"""
from __future__ import annotations

import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

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


def _restore_stash(stash_ref: str | None) -> None:
    if not stash_ref:
        return
    try:
        _git("stash", "apply", "--index", stash_ref)
    except UpdateError as exc:
        raise UpdateError(
            "Код обновлён, но автоматическое восстановление ваших локальных файлов "
            "обнаружило конфликт. Ваши изменения сохранены в Git stash ({}) и не удалены. "
            "Нужна ручная проверка конфликтующих файлов. Подробности: {}".format(stash_ref, exc)
        ) from exc
    # Удаляем сохранённую копию только после успешного восстановления.
    _git("stash", "drop", "stash@{0}")


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


def install_update(progress: Callable[[int, str], None] | None = None) -> dict:
    def report(percent: int, stage: str) -> None:
        if progress:
            progress(max(0, min(100, int(percent))), stage)

    report(3, "Подготовка обновления")
    current_branch = _git("branch", "--show-current")
    report(7, "Проверка рабочей ветки")
    if current_branch != BRANCH:
        raise UpdateError(
            "Обновление этой сборки разрешено только из ветки {}. Текущая ветка: {}.".format(
                BRANCH, current_branch or "detached HEAD"
            )
        )

    # Автоматически сохраняем изменённые и новые (untracked) файлы.
    # Игнорируемые каталоги, включая виртуальное окружение, не затрагиваются.
    stash_ref = None
    if _git("status", "--porcelain"):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        _git("stash", "push", "--include-untracked", "-m", "OSINT Panel auto-update {}".format(stamp))
        stash_ref = _git("rev-parse", "stash@{0}")

    try:
        report(18, "Проверка обновлений на сервере")
        check = check_update()
        if not check["available"]:
            _restore_stash(stash_ref)
            return {"updated": False, "message": "Установлена последняя версия.", **check}

        report(32, "Создание резервной копии")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        backup_branch = "backup/before-update-{}".format(stamp)
        _git("branch", backup_branch, "HEAD")
        try:
            report(48, "Загрузка файлов обновления")
            _git("merge", "--ff-only", "{}/{}".format(REMOTE, BRANCH))
        except UpdateError as exc:
            raise UpdateError(
                "Обновление не применено. Исходная версия сохранена в резервной ветке {}. {}".format(
                    backup_branch, str(exc)
                )
            ) from exc

        # Устанавливаем изменившиеся Python-зависимости до перезапуска приложения.
        try:
            report(65, "Установка Python-зависимостей")
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "-r", str(ROOT / "requirements.txt")],
                check=True, capture_output=True, text=True, timeout=600,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            detail = getattr(exc, "stderr", "") or str(exc)
            try:
                _git("reset", "--hard", backup_branch)
            except UpdateError as rollback_exc:
                raise UpdateError(
                    "Не удалось установить зависимости и выполнить автоматический откат. "
                    "Резервная ветка: {}. Ошибка отката: {}".format(backup_branch, rollback_exc)
                ) from exc
            raise UpdateError(
                "Установка зависимостей завершилась ошибкой; код автоматически возвращён к предыдущей версии. "
                "Резервная ветка: {}. {}".format(backup_branch, str(detail).strip())
            ) from exc

        # Возвращаем пользовательские файлы только после успешного обновления кода и зависимостей.
        report(91, "Восстановление ваших локальных файлов")
        _restore_stash(stash_ref)
        report(97, "Завершение обновления")
        after = check_update()
        report(98, "Проверка результата обновления")
        return {
            "updated": True,
            "backup_branch": backup_branch,
            "message": "Обновление установлено. Локальные файлы автоматически сохранены и восстановлены. Сервер будет перезапущен.",
            "restart_required": True,
            **after,
        }
    except UpdateError as exc:
        # Если установка не дошла до восстановления stash, возвращаем файлы на место.
        if stash_ref:
            try:
                if _git("stash", "list", "--format=%H") and stash_ref in _git("stash", "list", "--format=%H").splitlines():
                    _restore_stash(stash_ref)
            except UpdateError as restore_exc:
                raise UpdateError("{} Дополнительно: {}".format(exc, restore_exc)) from exc
        raise
