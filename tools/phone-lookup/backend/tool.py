"""Privacy-preserving phone number metadata lookup using libphonenumber."""
from __future__ import annotations

from typing import Any
import json
import os
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from tools.base import ToolBase


def _search_public_web(e164: str) -> dict[str, Any]:
    """Search public indexed pages through Brave Search or legacy Google CSE."""
    brave_key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
    google_key = os.environ.get("GOOGLE_CSE_API_KEY", "").strip()
    engine_id = os.environ.get("GOOGLE_CSE_CX", "").strip()

    if brave_key:
        provider = "Brave Search"
        provider_key = brave_key
    elif google_key and engine_id:
        provider = "Google Custom Search"
        provider_key = google_key
    else:
        return {
            "configured": False,
            "status": "not_configured",
            "provider": None,
            "provider_label": "Публичный веб-поиск",
            "message": (
                "Автопоиск не настроен. Добавьте BRAVE_SEARCH_API_KEY на сервере "
                "(рекомендуется) либо GOOGLE_CSE_API_KEY и GOOGLE_CSE_CX для старой интеграции."
            ),
            "services": [],
            "results": [],
        }

    digits = "".join(ch for ch in e164 if ch.isdigit())
    queries = [
        ("Общий публичный поиск", f'"{e164}" OR "{digits}"'),
        ("WhatsApp · публичные упоминания", f'"{e164}" OR "{digits}" (site:wa.me OR site:whatsapp.com)'),
        ("Telegram · публичные страницы", f'"{e164}" OR "{digits}" site:t.me'),
        ("imo · публичные упоминания", f'"{e164}" OR "{digits}" (site:imo.im OR site:imoapp.com)'),
        ("Социальные сети · публичные страницы", f'"{e164}" OR "{digits}" (site:instagram.com OR site:facebook.com OR site:vk.com OR site:tiktok.com OR site:x.com OR site:linkedin.com)'),
        ("Спам · публичные жалобы", f'"{e164}" OR "{digits}" (spam OR scam OR мошенничество OR спам OR нежелательный звонок)'),
        ("Бизнес · публичные контакты", f'"{e164}" OR "{digits}" (company OR business OR контакты OR компания OR телефон)'),
    ]
    services: list[dict[str, Any]] = []
    results: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    brave_min_interval = 1.0  # Conservative default until the API exposes the account limit.
    last_brave_request = 0.0

    for label, query in queries:
        try:
            if provider == "Brave Search":
                now = time.monotonic()
                if last_brave_request:
                    wait = brave_min_interval - (now - last_brave_request)
                    if wait > 0:
                        time.sleep(wait)
                last_brave_request = time.monotonic()
                params = urlencode({"q": query, "count": 5, "safesearch": "moderate"})
                request = Request(
                    "https://api.search.brave.com/res/v1/web/search?" + params,
                    headers={
                        "Accept": "application/json",
                        "X-Subscription-Token": provider_key,
                        "User-Agent": "OSINT-Panel-PhoneLookup/2.6",
                    },
                )
                with urlopen(request, timeout=12) as response:
                    payload = json.loads(response.read(1_000_000).decode("utf-8"))
                    headers = getattr(response, "headers", {})
                    limit = headers.get("X-RateLimit-Limit") if hasattr(headers, "get") else None
                    if limit:
                        try:
                            requests_per_second = max(0.1, float(str(limit).split(",")[0].strip()))
                            brave_min_interval = 1.0 / requests_per_second
                        except (TypeError, ValueError):
                            pass
                items = (payload.get("web") or {}).get("results") or []
                title_key, snippet_key = "title", "description"
            else:
                params = urlencode({
                    "key": provider_key, "cx": engine_id, "q": query, "num": 5,
                })
                request = Request(
                    "https://www.googleapis.com/customsearch/v1?" + params,
                    headers={"Accept": "application/json", "User-Agent": "OSINT-Panel-PhoneLookup/2.6"},
                )
                with urlopen(request, timeout=12) as response:
                    payload = json.loads(response.read(1_000_000).decode("utf-8"))
                items = payload.get("items") or []
                title_key, snippet_key = "title", "snippet"

            found = 0
            for item in items[:5]:
                link = str(item.get("url") or item.get("link") or "").strip()
                if not link.startswith(("https://", "http://")) or link in seen_urls:
                    continue
                seen_urls.add(link)
                results.append({
                    "title": str(item.get(title_key) or "Без заголовка")[:240],
                    "url": link[:2000],
                    "snippet": str(item.get(snippet_key) or "")[:600],
                    "source": label,
                })
                found += 1
            services.append({
                "name": label,
                "status": "found" if found else "no_public_results",
                "count": found,
            })
        except Exception as exc:
            # Keep credentials and provider response bodies out of user-facing errors.
            code = getattr(exc, "code", None)
            services.append({
                "name": label,
                "status": "error",
                "count": 0,
                "message": f"HTTP {code}" if isinstance(code, int) else type(exc).__name__,
            })

    found_total = len(results)
    return {
        "configured": True,
        "status": "completed" if any(s["status"] != "error" for s in services) else "provider_error",
        "provider": provider,
        "provider_label": provider,
        "message": (
            f"Провайдер: {provider}. Выполнено {len(queries)} поисковых направлений; "
            f"найдено {found_total} уникальных публичных страниц. "
            "Результаты не подтверждают принадлежность номера человеку или наличие частного аккаунта."
        ),
        "services": services,
        "results": results[:30],
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
