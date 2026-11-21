# Username Workspace

Единая рабочая область поиска публичных профилей по username.

## Структура

- `frontend/index.html` — основная страница.
- `frontend/css/username.css` — стили.
- `frontend/js/` — клиентские модули: API, прогресс, рендеринг, сводка, вкладки, toggles, меню и проверка.
- `manifest.json` — метаданные модуля.

## Backend-инструменты

Workspace использует отдельные tool-модули и их стабильные API:
- Sherlock
- Maigret
- Blackbird
- Social Analyzer

## Адреса

- Канонический: `/modules/username-workspace/`.
- Совместимый: `/username/`.

## Безопасность

Инструменты предназначены для поиска публично доступных профилей. Не добавляйте вход в аккаунты, подбор паролей или обход механизмов доступа.
