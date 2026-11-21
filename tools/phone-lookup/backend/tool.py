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
        return "Проверка формата и публичных метаданных международного номера."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        raw = str(params.get("phone") or "").strip()
        if not raw or not raw.startswith("+"):
            return {"success": False, "error": "Введите номер в международном формате, начиная с + (например, +12025550123)."}

        try:
            import phonenumbers
            from phonenumbers import carrier, number_type, PhoneNumberFormat, PhoneNumberType
        except ImportError:
            return {"success": False, "error": "Не установлена зависимость phonenumbers. Откройте Настройки → Проверить инструменты и установите её."}

        try:
            number = phonenumbers.parse(raw, None)
        except phonenumbers.NumberParseException as exc:
            return {"success": False, "error": f"Не удалось разобрать номер: {exc}."}

        if not phonenumbers.is_possible_number(number):
            return {"success": False, "error": "Номер невозможен для указанного плана нумерации."}
        if not phonenumbers.is_valid_number(number):
            return {"success": False, "error": "Формат распознан, но номер не соответствует известному диапазону действительных номеров."}

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
        lines = [
            f"Номер: {international}",
            f"Формат E.164: {e164}",
            f"Национальный формат: {national}",
            f"Код страны: +{number.country_code}",
            f"Регион плана нумерации: {region}",
            f"Тип номера: {type_names.get(kind, 'Не определён')}",
            f"Оператор по исходному диапазону: {carrier_name}",
            "Валидность: номер соответствует метаданным плана нумерации",
            "",
            "Важно: оператор может быть указан по исходному диапазону и не учитывать перенос номера. Проверка не устанавливает владельца, адрес или текущее местоположение абонента.",
            "Источник: локальная база метаданных libphonenumber.",
        ]
        return {
            "success": True,
            "output": "\n".join(lines),
            "metadata": {
                "e164": e164,
                "country_calling_code": number.country_code,
                "region": region,
                "number_type": type_names.get(kind, "Не определён"),
                "carrier": carrier_name,
            },
        }


__all__ = ["ToolPhoneLookup"]
