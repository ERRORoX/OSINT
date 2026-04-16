"""
Один ответ CSS на инструмент: база панели + стили вкладки без @import в HTML.
"""
from __future__ import annotations

import os

# Общая база для всех бандлов (порядок важен).
BUNDLE_BASE = (
    "variables.css",
    "layout.css",
    "tools.css",
    "proba-theme.css",
)

_SHARED_CLI = "tools/packs/_shared/cli.css"
_SHARED_GO = "tools/packs/_shared/google-osint.css"

# Файлы под static/css/ после базы
TOOL_CSS_TAILS: dict[str, tuple[str, ...]] = {
    # Домен: /domain/ — свой CSS в static/domain/css/domain.css (не бандл).
    # username-tools: страница /username/ — свой CSS в static/username/css/username.css (не бандл).
    "photo-search": (_SHARED_CLI, _SHARED_GO, "tools/packs/photo-search/tokens.css"),
    "history": (_SHARED_CLI, _SHARED_GO, "tools/packs/history/tokens.css"),
    "ai-agent": ("tools/packs/ai-agent/tokens.css", "tools/packs/ai-agent/panel.css"),
    "settings": ("tools/packs/settings/tokens.css", "tools/packs/settings/panel.css"),
    "anonsms": (
        _SHARED_CLI,
        "tools/packs/anonsms/tokens.css",
        "tools/packs/anonsms/panel.css",
        "tools/packs/anonsms/chrome.css",
    ),
    "instagram-bruter": (_SHARED_CLI, _SHARED_GO, "tools/packs/instagram-bruter/tokens.css", "tools/packs/instagram-bruter/panel.css"),
    "google-osint": (_SHARED_CLI, _SHARED_GO, "tools/packs/google-osint/tokens.css"),
}

# Относительно tools/grabcam/panel/ (без tool-grabcam.css — только листья, без @import)
GRABCAM_CSS_FILES = (
    "css/base.css",
    "css/shared.css",
    "css/widgets/control.css",
    "css/widgets/link.css",
    "css/widgets/map.css",
    "css/widgets/photos.css",
    "css/widgets/locations.css",
    "css/widgets/forms.css",
    "css/widgets/screen.css",
    "css/widgets/audio.css",
    "css/widgets/summary-text.css",
)

BUNDLE_TOOL_IDS = frozenset(TOOL_CSS_TAILS.keys()) | frozenset({"grabcam", "hub"})


def _read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def build_tool_css_bundle(*, static_root: str, grabcam_panel_dir: str, tool_id: str) -> str:
    if tool_id not in BUNDLE_TOOL_IDS:
        raise KeyError(tool_id)
    css_dir = os.path.join(static_root, "css")
    chunks: list[str] = []
    for name in BUNDLE_BASE:
        path = os.path.join(css_dir, name)
        chunks.append(f"\n/* === {name} === */\n")
        chunks.append(_read_file(path))
    if tool_id == "hub":
        path = os.path.join(css_dir, "hub-only.css")
        chunks.append("\n/* === hub-only.css === */\n")
        chunks.append(_read_file(path))
        return "".join(chunks)
    if tool_id == "grabcam":
        for rel in GRABCAM_CSS_FILES:
            path = os.path.join(grabcam_panel_dir, rel)
            chunks.append(f"\n/* === grabcam:{rel} === */\n")
            chunks.append(_read_file(path))
        return "".join(chunks)
    for rel in TOOL_CSS_TAILS[tool_id]:
        path = os.path.join(css_dir, rel)
        chunks.append(f"\n/* === {rel} === */\n")
        chunks.append(_read_file(path))
    return "".join(chunks)
