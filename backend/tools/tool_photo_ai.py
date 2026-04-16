"""
Инструмент: AI/Vision анализ изображения для страницы Фото.
Один tool_id, разные режимы через params["task"].
"""

from __future__ import annotations

from typing import Any

from .base import ToolBase


class ToolPhotoAI(ToolBase):
    @property
    def tool_id(self) -> str:
        return "photo-ai"

    @property
    def name(self) -> str:
        return "Фото: AI/Vision анализ"

    @property
    def description(self) -> str:
        return "Vision анализ изображения (AI): описание, лица, угрозы, геолокация, OCR и др. (через Ollama/OpenRouter/OpenAI)."

    def run(self, params: dict[str, Any]) -> dict[str, Any]:
        try:
            from backend.photo_ai import analyze_image_json  # type: ignore
        except Exception:
            # fallback относительный импорт (когда запускают как backend/app.py)
            from photo_ai import analyze_image_json  # type: ignore

        task = str(params.get("task") or "").strip().lower()
        image_url = (params.get("image_url") or params.get("imageUrl") or "").strip()
        if not image_url:
            return {"success": False, "error": "image_url обязателен (data URL или URL изображения)."}

        prompts: dict[str, str] = {
            "analysis": (
                "Верни строго JSON: {\"analysis\": \"...\"}.\n"
                "Сделай OSINT-ориентированное описание: кто/что на фото, контекст, важные детали, возможные зацепки, "
                "и блок '## Ключевые слова' списком (для веб-поиска)."
            ),
            "deep": (
                "Верни строго JSON вида:\n"
                "{\n"
                "  \"forensicAnalysis\": {\"compression\": \"...\", \"editingSigns\": \"...\", \"notes\": \"...\"},\n"
                "  \"threatAssessment\": {\"privacy\": \"...\", \"risk\": \"низкий|средний|высокий\", \"notes\": \"...\"},\n"
                "  \"investigationLeads\": [{\"lead\": \"...\", \"nextSteps\": \"...\", \"priority\": \"низкий|средний|высокий\"}]\n"
                "}\n"
                "Кратко, по делу."
            ),
            "face": (
                "Верни строго JSON: {\"faces\": [{\"age\": \"~\", \"gender\": \"~\", \"details\": \"...\", \"confidence\": \"низкая|средняя|высокая\"}] }.\n"
                "Если лиц не видно — faces пустой массив."
            ),
            "threat": (
                "Верни строго JSON: {\"threats\": [\"...\"], \"privacyRisks\": [\"...\"], \"notes\": \"...\"}.\n"
                "Опиши потенциально опасные объекты и риски приватности."
            ),
            "inventory": (
                "Верни строго JSON: {\"objects\": [\"...\"], \"peopleCount\": 0, \"vehicles\": [\"...\"], \"texts\": [\"...\"]}.\n"
                "Список объектов максимально конкретный."
            ),
            "geolocate": (
                "Верни строго JSON: {\"estimatedLocation\": {\"country\":\"\",\"region\":\"\",\"city\":\"\",\"latitude\":0,\"longitude\":0,\"confidence\":\"низкая|средняя|высокая\"},"
                "\"landmarks\":[\"...\"]}.\n"
                "Если не уверен — поставь confidence=низкая и latitude/longitude=0."
            ),
            "ocr": (
                "Верни строго JSON: {\"fullText\":\"...\", \"emails\":[], \"urls\":[], \"phones\":[], \"addresses\":[], \"names\":[], \"brands\":[]}.\n"
                "Извлеки максимум читаемого текста, а также email/url/телефоны если видны."
            ),
            "qr": (
                "Верни строго JSON: {\"decoded\": [\"...\"]}.\n"
                "Если QR/штрихкодов нет или не читается — пустой массив."
            ),
            "brand": (
                "Верни строго JSON: {\"brands\": [\"...\"], \"logos\": [\"...\"], \"notes\": \"...\"}."
            ),
            "vehicle": (
                "Верни строго JSON: {\"vehicles\": [{\"type\":\"\",\"make\":\"\",\"model\":\"\",\"plate\":\"\",\"confidence\":\"низкая|средняя|высокая\"}]}.\n"
                "Если нет транспорта — пустой массив."
            ),
            "cultural": (
                "Верни строго JSON: {\"languageHints\": [\"...\"], \"culturalSignals\": [\"...\"], \"notes\": \"...\"}."
            ),
            "social": (
                "Верни строго JSON: {\"identifiedPersons\": [{\"description\":\"...\", \"possiblePlatforms\": [\"...\"]}], \"hashtags\": [\"...\"]}.\n"
                "Не выдумывай личности; описывай только общие признаки/подсказки."
            ),
            "architecture": (
                "Верни строго JSON: {\"style\": \"...\", \"era\": \"...\", \"regionHints\": [\"...\"], \"notes\": \"...\"}."
            ),
            "vegetation": (
                "Верни строго JSON: {\"plants\": [\"...\"], \"climateHints\": [\"...\"], \"notes\": \"...\"}."
            ),
            "timestamp": (
                "Верни строго JSON: {\"estimatedTime\": \"...\", \"clues\": [\"...\"], \"confidence\": \"низкая|средняя|высокая\"}."
            ),
            "weather": (
                "Верни строго JSON: {\"conditions\": \"...\", \"clues\": [\"...\"], \"confidence\": \"низкая|средняя|высокая\"}."
            ),
        }

        if task not in prompts:
            return {"success": False, "error": f"Неизвестная задача task={task!r}."}

        # Дефолт ниже, чтобы OpenRouter с малым балансом не падал на 402.
        data = analyze_image_json(prompt=prompts[task], image_url=image_url, max_tokens=int(params.get("max_tokens") or 480))
        return data

