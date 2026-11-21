# Domain Search — модуль OSINT Panel

## Назначение

Пассивный анализ домена: WHOIS, DNS, TLS-сертификат и сведения из Certificate Transparency (crt.sh).

## Структура

- `manifest.json` — метаданные модуля и зависимости.
- `backend/domain_search.py` — логика получения и форматирования данных.
- `backend/tool.py` — адаптер публичного ToolBase-контракта.
- `tests/test_tool.py` — тесты контракта и проверки ввода.
- `OSINT_PANEL.md` — документация интеграции.

## Совместимость

Сохраняются:
- tool id: `domain-search`;
- API: `POST /api/tools/domain-search/run`;
- импорт `modules.domain_search` и экспорт `DomainSearch`, `run_domain_search`.

Старые файлы остаются compatibility layer и не являются местом для новой логики.

## Зависимости

- Python: `dnspython`, `requests`.
- Системная программа: `whois`.
- TLS-проверка использует стандартную библиотеку Python.
- crt.sh — публичный внешний источник.

Модуль не выполняет порт-сканирование. Не храните ключи и результаты внутри каталога исходников.
