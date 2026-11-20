# Domain Workspace

Единая интерфейсная рабочая область для анализа доменов и связанных открытых данных.

## Состав

- WHOIS, DNS, SSL и сертификаты — backend-инструмент `domain-search`.
- Сбор открытых email/поддоменов — `theharvester`.
- Shodan — `shodan`.
- Пассивное обнаружение поддоменов — `subfinder`.
- DNS A/AAAA/CNAME — `dnsx`.

## Структура

- `manifest.json` — описание workspace.
- `frontend/index.html` — основной документ.
- `frontend/css/domain.css` — стили интерфейса workspace.
- `frontend/js/domain.js` — клиентская логика и orchestration.
- `README.md` — документация.

## Адреса

- Канонический: `/modules/domain-workspace/`.
- Совместимый: `/domain/` — перенаправляет на канонический адрес.

## Архитектурная граница

Этот модуль отвечает за интерфейс и orchestration. Backend-инструменты остаются отдельными модулями со своими manifest и backend adapters. Общие API, история, workspace, навигация и дизайн-система принадлежат ядру и не копируются в модуль.

Не помещайте API-ключи и пользовательские результаты в исходные файлы модуля. Они должны храниться через общие механизмы настроек и workspace.
