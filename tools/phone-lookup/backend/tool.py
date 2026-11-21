"""Privacy-preserving phone number metadata lookup using libphonenumber."""
from __future__ import annotations

from typing import Any
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse
import json
import os
import time
from urllib.request import Request, urlopen

from tools.base import ToolBase


def _search_public_web(e164: str) -> dict[str, Any]:
    """Search a broad set of public, indexed web sources; never query private accounts or leaked dumps."""
    brave_key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
    google_key = os.environ.get("GOOGLE_CSE_API_KEY", "").strip()
    engine_id = os.environ.get("GOOGLE_CSE_CX", "").strip()
    if brave_key:
        provider, provider_key = "Brave Search", brave_key
    elif google_key and engine_id:
        provider, provider_key = "Google Custom Search", google_key
    else:
        return {
            "configured": False, "status": "not_configured", "provider": None,
            "provider_label": "Публичный веб-поиск",
            "message": "Добавьте BRAVE_SEARCH_API_KEY на сервере либо GOOGLE_CSE_API_KEY и GOOGLE_CSE_CX.",
            "services": [], "results": [],
        }

    digits = "".join(ch for ch in e164 if ch.isdigit())
    spaced = " ".join([digits[:3], digits[3:6], digits[6:]])
    exact = f'"{e164}" OR "{digits}" OR "{spaced}"'
    queries = [
        ("Общий поиск · точный номер", exact),
        ("Общий поиск · альтернативная запись", f'"{digits}" OR "{digits[1:]}"'),
        ("Одноклассники · публичные упоминания", f'{exact} site:ok.ru'),
        ("VK · публичные упоминания", f'{exact} site:vk.com'),
        ("Telegram · публичные страницы", f'{exact} site:t.me'),
        ("WhatsApp · публичные ссылки", f'{exact} (site:wa.me OR site:whatsapp.com)'),
        ("imo · публичные упоминания", f'{exact} (site:imo.im OR site:imoapp.com)'),
        ("Социальные сети · публичные страницы", f'{exact} (site:instagram.com OR site:facebook.com OR site:tiktok.com OR site:x.com OR site:linkedin.com)'),
        ("Объявления · публичные публикации", f'{exact} (объявление OR продажа OR аренда OR classifieds OR marketplace)'),
        ("Бизнес · публичные контакты", f'{exact} (контакты OR телефон OR компания OR business OR contact)'),
        ("Карты и каталоги · публичные карточки", f'{exact} (карта OR каталог OR directory OR maps OR справочник)'),
        ("Антиспам · жалобы и отзывы", f'{exact} (спам OR мошенничество OR нежелательный звонок OR scam OR spam OR robocall)'),
        ("Форумы · публичные обсуждения", f'{exact} (форум OR обсуждение OR отзывы OR forum OR discussion)'),
        ("Публичные документы и публикации", f'{exact} (filetype:pdf OR filetype:doc OR filetype:xls)'),
        ("Видео и сообщества", f'{exact} (site:youtube.com OR site:reddit.com OR site:github.com)'),
    ]
    services: list[dict[str, Any]] = []
    results: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    min_interval, last_request = 1.0, 0.0
    retrieved_at = datetime.now(timezone.utc).isoformat()
    for label, query in queries:
        try:
            if provider == "Brave Search":
                now = time.monotonic()
                if last_request:
                    time.sleep(max(0.0, min_interval - (now - last_request)))
                last_request = time.monotonic()
                request = Request(
                    "https://api.search.brave.com/res/v1/web/search?" + urlencode({"q": query, "count": 10, "safesearch": "moderate"}),
                    headers={"Accept": "application/json", "X-Subscription-Token": provider_key,
                             "User-Agent": "OSINT-Panel-PhoneLookup/2.7"},
                )
                with urlopen(request, timeout=15) as response:
                    payload = json.loads(response.read(1_000_000).decode("utf-8"))
                    headers = getattr(response, "headers", {})
                    limit = headers.get("X-RateLimit-Limit") if hasattr(headers, "get") else None
                    if limit:
                        try:
                            min_interval = 1.0 / max(0.1, float(str(limit).split(",")[0].strip()))
                        except (TypeError, ValueError):
                            pass
                items = (payload.get("web") or {}).get("results") or []
            else:
                request = Request(
                    "https://www.googleapis.com/customsearch/v1?" + urlencode(
                        {"key": provider_key, "cx": engine_id, "q": query, "num": 10}
                    ),
                    headers={"Accept": "application/json", "User-Agent": "OSINT-Panel-PhoneLookup/2.7"},
                )
                with urlopen(request, timeout=15) as response:
                    payload = json.loads(response.read(1_000_000).decode("utf-8"))
                items = payload.get("items") or []

            found = 0
            for item in items[:10]:
                link = str(item.get("url") or item.get("link") or "").strip()
                if not link.startswith(("https://", "http://")) or link in seen_urls:
                    continue
                seen_urls.add(link)
                results.append({
                    "title": str(item.get("title") or "Без заголовка")[:240],
                    "url": link[:2000],
                    "domain": (urlparse(link).hostname or "").lower()[:180],
                    "snippet": str(item.get("description") or item.get("snippet") or "")[:600],
                    "source": label,
                    "query": query[:500],
                    "retrieved_at": retrieved_at,
                    "confidence": "низкая",
                    "confidence_reason": "Совпадение найдено поисковым индексом; принадлежность номера и актуальность сведений не подтверждены.",
                })
                found += 1
            services.append({"name": label, "status": "found" if found else "no_public_results", "count": found})
        except Exception as exc:
            code = getattr(exc, "code", None)
            services.append({"name": label, "status": "error", "count": 0,
                             "message": f"HTTP {code}" if isinstance(code, int) else type(exc).__name__})

    successful = sum(s["status"] != "error" for s in services)
    return {
        "configured": True,
        "status": "completed" if successful else "provider_error",
        "provider": provider, "provider_label": provider,
        "retrieved_at": retrieved_at,
        "message": (
            f"Провайдер: {provider}. Выполнено {len(queries)} поисковых направлений; "
            f"найдено {len(results)} уникальных публичных страниц. Совпадения требуют проверки."
        ),
        "methodology": "Публичный поисковый индекс; результаты не доказывают владельца номера, регистрацию аккаунта или актуальность данных.",
        "services": services, "results": results[:100],
    }

def _search_public_person(name: str, location: str = "") -> dict[str, Any]:
    """Search indexed public pages for a supplied name; do not enumerate accounts or private data."""
    brave_key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
    google_key = os.environ.get("GOOGLE_CSE_API_KEY", "").strip()
    engine_id = os.environ.get("GOOGLE_CSE_CX", "").strip()
    if brave_key:
        provider, provider_key = "Brave Search", brave_key
    elif google_key and engine_id:
        provider, provider_key = "Google Custom Search", google_key
    else:
        return {"configured": False, "status": "not_configured", "provider": None,
                "message": "Добавьте BRAVE_SEARCH_API_KEY на сервере (или GOOGLE_CSE_API_KEY и GOOGLE_CSE_CX).",
                "services": [], "results": []}

    safe_name = name.replace('"', " ").strip()
    safe_location = location.replace('"', " ").strip()
    quoted = '"' + safe_name + '"'
    place = f' "{safe_location}"' if safe_location else ""
    queries = [
        ("Одноклассники · имя и регион", f"site:ok.ru {quoted}{place}"),
        ("Одноклассники · имя без региона", f"site:ok.ru {quoted}"),
        ("VK · публичные профили", f"site:vk.com {quoted}{place}"),
        ("Общий веб · точное имя", f"{quoted}{place}"),
        ("Социальные сети · публичные страницы", f'{quoted}{place} (site:facebook.com OR site:instagram.com OR site:linkedin.com OR site:tiktok.com)'),
        ("Публичные публикации и объявления", f'{quoted}{place} (объявления OR публикации OR контакты OR business)'),
        ("Форумы и сообщества", f'{quoted}{place} (site:reddit.com OR site:github.com OR forum OR форум)'),
        ("Варианты написания", f'"{safe_name.replace(" ", " ")}" {safe_location}'),
    ]
    services, results, seen = [], [], set()
    interval, last_request = 1.0, 0.0
    retrieved_at = datetime.now(timezone.utc).isoformat()
    for label, query in queries:
        try:
            if provider == "Brave Search":
                now = time.monotonic()
                if last_request:
                    time.sleep(max(0.0, interval - (now - last_request)))
                last_request = time.monotonic()
                request = Request(
                    "https://api.search.brave.com/res/v1/web/search?" + urlencode({"q": query, "count": 10, "safesearch": "moderate"}),
                    headers={"Accept": "application/json", "X-Subscription-Token": provider_key,
                             "User-Agent": "OSINT-Panel-PersonSearch/2.7"},
                )
                with urlopen(request, timeout=15) as response:
                    payload = json.loads(response.read(1_000_000).decode("utf-8"))
                items = (payload.get("web") or {}).get("results") or []
            else:
                request = Request(
                    "https://www.googleapis.com/customsearch/v1?" + urlencode(
                        {"key": provider_key, "cx": engine_id, "q": query, "num": 10}
                    ),
                    headers={"Accept": "application/json", "User-Agent": "OSINT-Panel-PersonSearch/2.7"},
                )
                with urlopen(request, timeout=15) as response:
                    payload = json.loads(response.read(1_000_000).decode("utf-8"))
                items = payload.get("items") or []
            count = 0
            for item in items[:10]:
                link = str(item.get("url") or item.get("link") or "").strip()
                if not link.startswith(("https://", "http://")) or link in seen:
                    continue
                seen.add(link)
                results.append({
                    "title": str(item.get("title") or "Публичная страница")[:240],
                    "url": link[:2000], "domain": (urlparse(link).hostname or "").lower()[:180],
                    "snippet": str(item.get("description") or item.get("snippet") or "")[:600],
                    "source": label, "query": query[:500], "retrieved_at": retrieved_at,
                    "match_type": "поисковое совпадение, не подтверждённая личность",
                    "confidence": "низкая",
                    "confidence_reason": "Совпадение по имени не подтверждает, что страница принадлежит искомому человеку.",
                })
                count += 1
            services.append({"name": label, "status": "found" if count else "no_public_results", "count": count})
        except Exception as exc:
            code = getattr(exc, "code", None)
            services.append({"name": label, "status": "error", "count": 0,
                             "message": f"HTTP {code}" if isinstance(code, int) else type(exc).__name__})
    successful = sum(item["status"] != "error" for item in services)
    return {
        "configured": True, "status": "completed" if successful else "provider_error",
        "provider": provider, "provider_label": provider, "retrieved_at": retrieved_at,
        "message": f"Поиск завершён: {len(results)} уникальных публичных страниц. Совпадения по ФИО требуют ручной проверки.",
        "services": services, "results": results[:80],
        "privacy_note": "Проверяются публично индексируемые страницы. Закрытые профили, аккаунт-энумерация и сырые дампы утечек не проверяются.",
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


    def search_person(self, name: str, location: str = "") -> dict[str, Any]:
        clean_name = " ".join(str(name or "").split())
        clean_location = " ".join(str(location or "").split())
        if len(clean_name) < 3 or len(clean_name) > 120:
            return {"success": False, "error": "Введите имя и фамилию (от 3 до 120 символов)."}
        if len(clean_location) > 100:
            return {"success": False, "error": "Слишком длинное название города или страны."}
        return {"success": True, "person_search": _search_public_person(clean_name, clean_location)}

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
