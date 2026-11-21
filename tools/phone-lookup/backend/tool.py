"""Privacy-preserving phone number metadata lookup using libphonenumber."""
from __future__ import annotations

from typing import Any
import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from tools.base import ToolBase


def _search_public_web(e164: str) -> dict[str, Any]:
    """Search only public indexed pages via an explicitly configured Google CSE."""
    api_key = os.environ.get("GOOGLE_CSE_API_KEY", "").strip()
    engine_id = os.environ.get("GOOGLE_CSE_CX", "").strip()
    if not api_key or not engine_id:
        return {
            "configured": False,
            "status": "not_configured",
            "message": "Автопоиск не настроен: добавьте GOOGLE_CSE_API_KEY и GOOGLE_CSE_CX на сервере. Поиск по закрытым аккаунтам не выполняется.",
            "services": [],
            "results": [],
        }

    digits = "".join(ch for ch in e164 if ch.isdigit())
    queries = [
        ("Google · общий публичный поиск", f'"{e164}" OR "{digits}"'),
        ("WhatsApp · публичные упоминания", f'"{e164}" OR "{digits}" (site:wa.me OR site:whatsapp.com)'),
        ("Telegram · публичные страницы", f'"{e164}" OR "{digits}" site:t.me'),
        ("imo · публичные упоминания", f'"{e164}" OR "{digits}" (site:imo.im OR site:imoapp.com)'),
    ]
    services = []
    results = []
    for label, query in queries:
        try:
            params = urlencode({"key": api_key, "cx": engine_id, "q": query, "num": 5})
            request = Request(
                "https://www.googleapis.com/customsearch/v1?" + params,
                headers={"Accept": "application/json", "User-Agent": "OSINT-Panel-PhoneLookup/1.0"},
            )
            with urlopen(request, timeout=8) as response:
                payload = json.loads(response.read(1_000_000).decode("utf-8"))
            items = payload.get("items") or []
            found = []
            for item in items[:5]:
                link = str(item.get("link") or "")
                if not link.startswith(("https://", "http://")):
                    continue
                found.append({
                    "title": str(item.get("title") or "Без заголовка")[:240],
                    "url": link[:2000],
                    "snippet": str(item.get("snippet") or "")[:600],
                    "source": label,
                })
            results.extend(found)
            services.append({"name": label, "status": "found" if found else "no_public_results", "count": len(found)})
        except Exception as exc:
            services.append({"name": label, "status": "error", "count": 0, "message": type(exc).__name__})
    return {
        "configured": True,
        "status": "completed",
        "message": "Проверены только публично индексируемые страницы. Нулевой результат не означает, что аккаунта нет.",
        "services": services,
        "results": results[:20],
    }


class ToolPhoneLookup(ToolBase):
    @property
    def tool_id(self) -> str:
        return "phone-lookup"

    @property
    def name(self) -> str:
        return "Phone Number Intelligence"

    @property
    def description(self) -> str:
        return "Проверка формата и публичных технических метаданных международного номера."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        raw = str(params.get("phone") or "").strip()
        if not raw or not raw.startswith("+"):
            return {"success": False, "error": "Введите номер в международном формате, начиная с + (например, +992...)."}
        if len(raw) > 40:
            return {"success": False, "error": "Слишком длинный ввод. Проверьте номер."}

        try:
            import phonenumbers
            from phonenumbers import (
                PhoneNumberFormat, PhoneNumberType, carrier, geocoder,
                number_type, timezone,
            )
        except ImportError:
            return {"success": False, "error": "Не установлена зависимость phonenumbers. Откройте Настройки → Проверить инструменты и установите её."}

        try:
            number = phonenumbers.parse(raw, None, keep_raw_input=True)
        except phonenumbers.NumberParseException:
            return {"success": False, "error": "Не удалось разобрать номер. Проверьте код страны и формат."}

        possible_reason = phonenumbers.is_possible_number_with_reason(number)
        reason_names = {
            phonenumbers.ValidationResult.IS_POSSIBLE: "Возможная длина",
            phonenumbers.ValidationResult.IS_POSSIBLE_LOCAL_ONLY: "Возможен только локальный формат",
            phonenumbers.ValidationResult.INVALID_COUNTRY_CODE: "Недопустимый код страны",
            phonenumbers.ValidationResult.TOO_SHORT: "Слишком короткий номер",
            phonenumbers.ValidationResult.TOO_LONG: "Слишком длинный номер",
            phonenumbers.ValidationResult.INVALID_LENGTH: "Недопустимая длина",
        }
        if possible_reason != phonenumbers.ValidationResult.IS_POSSIBLE:
            return {"success": False, "error": "Номер не соответствует ожидаемой длине: " + reason_names.get(possible_reason, "неизвестная причина") + "."}
        if not phonenumbers.is_valid_number(number):
            return {"success": False, "error": "Формат распознан, но номер не входит в известный действительный диапазон плана нумерации."}

        kind = number_type(number)
        type_names = {
            PhoneNumberType.FIXED_LINE: "Стационарный",
            PhoneNumberType.MOBILE: "Мобильный",
            PhoneNumberType.FIXED_LINE_OR_MOBILE: "Стационарный или мобильный",
            PhoneNumberType.TOLL_FREE: "Бесплатный",
            PhoneNumberType.PREMIUM_RATE: "Премиум-тариф",
            PhoneNumberType.SHARED_COST: "Совместная оплата",
            PhoneNumberType.VOIP: "VoIP",
            PhoneNumberType.PERSONAL_NUMBER: "Персональный номер",
            PhoneNumberType.PAGER: "Пейджер",
            PhoneNumberType.UAN: "Универсальный номер",
            PhoneNumberType.VOICEMAIL: "Голосовая почта",
            PhoneNumberType.UNKNOWN: "Не определён",
        }
        region = phonenumbers.region_code_for_number(number) or "Не определён"
        carrier_name = carrier.name_for_number(number, "ru") or carrier.name_for_number(number, "en") or "Нет сведений"
        e164 = phonenumbers.format_number(number, PhoneNumberFormat.E164)
        international = phonenumbers.format_number(number, PhoneNumberFormat.INTERNATIONAL)
        national = phonenumbers.format_number(number, PhoneNumberFormat.NATIONAL)
        country_name = geocoder.country_name_for_number(number, "ru") or geocoder.country_name_for_number(number, "en") or region
        geographic_description = geocoder.description_for_number(number, "ru") or geocoder.description_for_number(number, "en") or ""
        time_zones = list(timezone.time_zones_for_number(number))
        extension = getattr(number, "extension", "") or ""
        # This tool accepts only E.164 input beginning with '+', so the source
        # is known from the raw input. Avoid relying on non-portable enum fields
        # that are absent from some python-phonenumbers versions.
        country_code_source = "Международный номер с +"
        number_type_code = getattr(kind, "name", "UNKNOWN")
        metadata = {
            "e164": e164,
            "national_significant_number": str(number.national_number),
            "country_code_source": country_code_source,
            "number_type_code": number_type_code,
            "is_possible": True,
            "is_valid": True,
            "carrier_note": "Справка по исходному диапазону; перенос номера может изменить фактического оператора.",
            "geographic_note": "Справочная зона плана нумерации, не местоположение абонента.",
            "international": international,
            "national": national,
            "country_calling_code": number.country_code,
            "country_name": country_name,
            "region": region,
            "region_name": region,
            "geographic_description": geographic_description,
            "number_type": type_names.get(kind, "Не определён"),
            "carrier": carrier_name,
            "time_zones": time_zones,
            "extension": extension,
            "possible_reason": reason_names.get(possible_reason, "Возможная длина"),
            "valid": True,
            "source": "libphonenumber",
        }
        lines = [
            f"Номер: {international}",
            f"Формат E.164: {e164}",
            f"Национальный формат: {national}",
            f"Страна: {country_name}",
            f"Код страны: +{number.country_code}",
            f"Регион плана нумерации: {region}",
            f"Географическое описание: {geographic_description or 'Нет справочных данных'}",
            f"Тип номера: {metadata['number_type']} ({number_type_code})",
            f"Значащая часть национального номера: {number.national_number}",
            f"Источник кода страны: {country_code_source}",
            f"Оператор исходного диапазона: {carrier_name}",
            f"Часовые пояса: {', '.join(time_zones) or 'Нет сведений'}",
            "Валидность: соответствует известному плану нумерации",
            "",
            "Важно: это не проверка активности SIM-карты и не подтверждение владельца. Оператор может не учитывать перенос номера. Географическое описание — справочное, не текущее местоположение.",
            "Данные оператора и географии относятся к плану нумерации и не доказывают фактическое использование номера.",
            "Источник: локальная база метаданных libphonenumber.",
        ]
        report = {"success": True, "output": "\n".join(lines), "metadata": metadata}
        if params.get("search_public") is True:
            report["public_search"] = _search_public_web(e164)
        return report


__all__ = ["ToolPhoneLookup"]
