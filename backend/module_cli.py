"""Command-line diagnostics for OSINT Panel module manifests.

Usage:
  python backend/module_cli.py list
  python backend/module_cli.py check
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from module_registry import discover_modules


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="OSINT Panel module diagnostics")
    parser.add_argument("command", choices=("list", "check"), help="list discovered modules or validate all manifests")
    args = parser.parse_args(argv)

    result = discover_modules(PROJECT_ROOT)
    if args.command == "list":
        for module in result["modules"]:
            state = "OK" if module["valid"] else "ERROR"
            enabled = "enabled" if module["enabled"] else "disabled"
            print(f"[{state}] {module['id']:<22} {module['name']} ({module['status']}, {enabled})")
        summary = result["summary"]
        print(
            f"\nDiscovered: {summary['discovered']} | Valid: {summary['valid']} | "
            f"Invalid: {summary['invalid']} | Enabled: {summary['enabled']}"
        )
        return 0 if summary["invalid"] == 0 else 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    summary = result["summary"]
    return 0 if summary["invalid"] == 0 and not result["issues"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
