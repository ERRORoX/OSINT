"""Privacy-preserving phone number metadata lookup using libphonenumber."""
from __future__ import annotations

from typing import Any

from tools.base import ToolBase


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
            number = phonenumbers.parse(raw, None)
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
        country_code_sources = {
            phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITH_PLUS_SIGN: "Международный номер с +",
            phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITH_IDD: "Международный префикс выхода",
            phonenumbers.PhoneNumber.CountryCodeSource.FROM_NUMBER_WITHOUT_PLUS_SIGN: "Код страны без +",
            phonenumbers.PhoneNumber.CountryCodeSource.FROM_DEFAULT_COUNTRY: "Регион по умолчанию",
        }
        country_code_source = country_code_sources.get(
            getattr(number, "country_code_source", None), "Не определён"
        )
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
        return {"success": True, "output": "\n".join(lines), "metadata": metadata}


__all__ = ["ToolPhoneLookup"]
