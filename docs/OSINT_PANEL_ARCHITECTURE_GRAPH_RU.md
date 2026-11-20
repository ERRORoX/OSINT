# Архитектурный граф OSINT Panel 4.2

Документ показывает фактическую структуру текущей ветки, а не желаемую конечную архитектуру. Он нужен для планирования следующих этапов миграции и поиска точек, где ещё сохраняется legacy-совместимость.

## 1. Общая архитектура

```mermaid
flowchart TB
    U["Пользователь / браузер"]
    HOME["Домашняя страница\nstatic/index.html"]
    HUB["Навигация и карточки\nstatic/js/app-hub.js"]
    PAGES["Страницы модулей\n/modules/<module-id>/"]
    API["Flask API\nbackend/app.py"]

    MAN["Manifest-файлы\ntools/*/manifest.json"]
    REG["Module Registry\nbackend/module_registry.py"]
    NAV["GET /api/navigation\nпроверка зарегистрированных Flask routes"]
    DIAG["GET /api/modules\nдиагностика manifest/runtime"]
    RUNTIME["Module Runtime\nbackend/module_runtime.py"]
    TOOLS["Центральный реестр инструментов\nbackend/tools.py + ToolBase"]
    MODS["Интегрированные backend-модули\ntools/<id>/backend/tool.py"]
    LEGACY["Legacy compatibility layer\nanonsms / instagram-bruter"]
    DB["SQLite / история запусков"]
    UPD["Updater\nbackend/update_manager.py"]
    GIT["Git remote / backup branch / stash"]

    U --> HOME
    HOME --> HUB
    HUB -->|запрашивает список страниц| NAV
    NAV --> REG
    NAV -->|сверяет URL с Flask route map| API
    HUB -->|запрашивает инструменты| API
    PAGES --> API
    API --> DIAG
    DIAG --> REG
    REG --> MAN
    RUNTIME --> REG
    RUNTIME --> MODS
    RUNTIME --> TOOLS
    LEGACY --> TOOLS
    API --> TOOLS
    API --> DB
    API --> UPD
    UPD --> GIT
```

## 2. Поток загрузки модулей

```mermaid
flowchart TD
    A["tools/<id>/manifest.json"] --> B["Module Registry: чтение и валидация"]
    B --> C{"Manifest валиден и enabled?"}
    C -->|нет| D["Только диагностика / не загружать"]
    C -->|да| E{"status"}
    E -->|integrated| F{"Есть backend_adapter?"}
    F -->|да| G["Проверка канонического пути\ntools/<id>/backend/tool.py"]
    G --> H["Проверка ToolBase и совпадения tool_id"]
    H --> I["Центральный реестр инструментов"]
    F -->|нет| J["Frontend workspace / без backend-класса"]
    E -->|legacy| K["Существующий compatibility layer"]
```

## 3. Поток домашней навигации

```mermaid
sequenceDiagram
    participant B as Браузер
    participant H as app-hub.js
    participant A as Flask API
    participant R as Module Registry
    B->>H: Открытие главной страницы
    H->>A: GET /api/navigation
    A->>R: discover_modules()
    R-->>A: Валидные enabled integrated manifests
    A->>A: Проверка href по app.url_map
    A-->>H: Только реально зарегистрированные страницы
    H->>H: Обновление ссылок меню и карточек
```

## 4. Где находятся компоненты сейчас

| Область | Текущий владелец | Состояние |
|---|---|---|
| Manifest и discovery | `tools/*/manifest.json`, `backend/module_registry.py` | Работает |
| Backend runtime | `backend/module_runtime.py` | Загружает интегрированные backend-модули по каноническому пути |
| Центральный API и Flask routes | `backend/app.py` | Работает, содержит compatibility routes |
| Домашняя навигация | `static/js/app-hub.js` | Получает manifest-driven список через `/api/navigation` |
| UI и общие стили | `static/` | Частично общие, ещё не вынесены в `core/` |
| История | `backend/` + SQLite | Работает через API |
| Обновление | `backend/update_manager.py`, `static/js/settings.js` | Единая кнопка, job status и прогресс |
| Vendor-проекты | `tools/<id>/` | Остаются внутри своих каталогов; переносить механически нельзя |

## 5. Важные границы

- Manifest — декларативные данные; он не должен исполнять произвольные пути.
- Backend runtime загружает только интегрированные backend-адаптеры из `tools/<id>/backend/tool.py`.
- Наличие frontend-файла само по себе не означает, что страница доступна: ссылка попадает в навигацию только при наличии соответствующего Flask route.
- Два legacy-модуля не переводятся в integrated автоматически: для них нужна отдельная проверка поведения и рисков.
- Каталог `core/` пока не является фактическим общим ядром проекта. Его создание отложено до выделения стабильных контрактов и тестов.
- GrabCam остаётся consent-based: никакой скрытой съёмки, скрытого доступа к файлам или скрытого сбора геолокации.

## 6. Следующие этапы по графу

1. Завершить аудит соответствия всех manifest-полей реальным Flask routes и frontend-файлам.
2. Перевести повторяющиеся compatibility routes на единый безопасный route helper, не меняя публичные URL.
3. Выделить стабильные общие контракты UI/API до создания `core/`.
4. Свести управление зависимостями к единому dependency manager; не запускать установку зависимостей из каждого модуля автоматически.
5. Добавлять регрессионные тесты для каждого маршрута до удаления старых копий.
