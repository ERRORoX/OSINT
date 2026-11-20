"""Пассивная проверка IP через публичный RDAP endpoint."""
from __future__ import annotations

import ipaddress
import json
import urllib.error
import urllib.request
from typing import Any

from .base import ToolBase

RDAP_URL = "https://rdap.org/ip/"


class ToolIPRDAP(ToolBase):
    @property
    def tool_id(self) -> str:
        return "ip-rdap"

    @property
    def name(self) -> str:
        return "IP / RDAP"

    @property
    def description(self) -> str:
        return "Пассивная информация о публичном IP: сеть, организация, страна и даты регистрации (RDAP)."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        raw_ip = str(params.get("ip") or "").strip()
        try:
            address = ipaddress.ip_address(raw_ip)
        except ValueError:
            return {"success": False, "error": "Введите корректный IPv4 или IPv6 адрес."}
        if not address.is_global:
            return {"success": False, "error": "Для защиты приватности принимаются только публичные IP-адреса."}

        request = urllib.request.Request(
            RDAP_URL + address.compressed,
            headers={"Accept": "application/rdap+json", "User-Agent": "OSINT-Panel/4.2"},
        )
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                payload = json.loads(response.read(1_000_000).decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as exc:
            return {"success": False, "error": f"RDAP вернул HTTP {exc.code}."}
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            return {"success": False, "error": f"Не удалось получить RDAP-данные: {str(exc)[:180]}"}

        events = payload.get("events") or []
        dates = {}
        for event in events:
            action = str(event.get("eventAction") or "").lower()
            if action in {"registration", "last changed", "expiration"}:
                dates[action] = event.get("eventDate", "—")

        entities = payload.get("entities") or []
        organizations = []
        for entity in entities:
            for item in entity.get("vcardArray", [None, []])[1] if isinstance(entity.get("vcardArray"), list) and len(entity["vcardArray"]) > 1 else []:
                if len(item) > 3 and item[0] == "fn" and item[3]:
                    organizations.append(str(item[3]))

        lines = [
            f"IP: {address.compressed}",
            f"Версия: IPv{address.version}",
            f"Сеть: {payload.get('startAddress', '—')} – {payload.get('endAddress', '—')}",
            f"CIDR: {', '.join(payload.get('cidr0_cidrs') or []) or '—'}",
            f"Название сети: {payload.get('name') or '—'}",
            f"Тип: {payload.get('type') or '—'}",
            f"Страна: {payload.get('country') or '—'}",
            f"Организация: {', '.join(dict.fromkeys(organizations)) or 'не указана'}",
            f"Регистрация: {dates.get('registration', '—')}",
            f"Изменено: {dates.get('last changed', '—')}",
            f"Источник: {payload.get('port43') or 'RDAP'}",
        ]
        return {"success": True, "output": "\n".join(lines), "source": "RDAP"}
