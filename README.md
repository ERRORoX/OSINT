# OSINT Panel

<<<<<<< HEAD
**Веб-панель для учебной и легитимной разведки в открытых источниках (OSINT).**  
Единый интерфейс на Flask: домены, имена пользователей, email, вспомогательные инструменты, история запусков.

| | |
|---|---|
| **Стек** | Python 3 (Flask), HTML/CSS/JS, SQLite |
| **Версия интерфейса** | 3.x — хаб, отдельные страницы инструментов, CSS-бандлы |
| **Репозиторий** | [github.com/ERRORoX/OSINT](https://github.com/ERRORoX/OSINT) |

*При необходимости добавьте сюда вуз, группу, ФИО авторов, год и email — по образцу учебного README.*

---

## 1. Назначение

Панель предназначена для:

- **сбора информации из открытых источников** по домену, поддоменам, DNS, сертификатам, публичным API (в рамках закона и политики сервисов);
- **поиска следов username** через интегрированные CLI-инструменты (Sherlock, Maigret, Social Analyzer, Blackbird и др.);
- **работы с email** в связке Holehe / h8mail (раздел Google OSINT);
- **вспомогательных сценариев**: Google OSINT, AI-агент, Instagram Bruter, AnonSMS, Grabcam (только в **законных и этичных** целях, см. §12);
- **фото**: поиск по изображению, OCR, QR, опционально AI — при наличии ключей и системных утилит;
- **ведения истории** запусков инструментов в SQLite.

Логика каждого инструмента изолирована в `backend/tools/`; общие части — маршруты API, БД, раздача статики и сборка CSS-бандлов.

---

## 2. Возможности (кратко по разделам)

| Раздел | URL / вход | Суть |
|--------|------------|------|
| **Хаб** | `/` | Карточки инструментов, переход на вкладки |
| **Домен** | `/domain/` | WHOIS, DNS, поддомены, внешние сервисы — свой UI и `static/domain/` |
| **Username** | `/username/` | Мульти-инструмент (Sherlock, Maigret, …), прогресс, вкладки |
| **Фото** | `/photo/` | Поиск, OCR, QR, AI (по конфигурации) |
| **Инструменты (вкладки)** | `/p/<id>/` | Например: `google-osint`, `ai-agent`, `instagram-bruter`, `anonsms`, `grabcam`, `history`, `settings` |
| **История** | `/p/history/` | Просмотр сохранённых запусков |
| **Настройки** | `/p/settings/` | Ключи API (через бэкенд и `.env`, не коммитить) |

Стили вкладок с хаба: один запрос **`/css/tool-bundle/<tool_id>.css`** (сборка из `backend/css_bundle.py` + `static/css/tools/packs/…`). Домен и Username используют **свои** каталоги CSS в `static/domain/` и `static/username/`.

---

## 3. Стек технологий

- **Backend:** Flask, `flask-cors`, вызовы внешних утилит через `subprocess` и собственные модули в `backend/tools/`.
- **Frontend:** статические страницы, ES-модули (`static/js/app-hub.js`, `app-core.js`, `header-*.js`, `static/p/<id>/page.js`).
- **Данные:** SQLite (`data/` или файл в корне — см. `backend/db/`), не коммитить рабочие БД с чувствительными данными.
- **Интеграции:** внешние Python/Go-проекты в каталоге `tools/` (часть поставляется с репозиторием).

---

## 4. Архитектура проекта

```
OSINT HTML V3.0/
├── run.py                    # Точка входа: venv/зависимости, запуск Flask на :5000
├── requirements.txt          # Все Python-зависимости панели и обёрток
├── backend/
│   ├── app.py                # Маршруты, API, раздача static/, бандлы CSS
│   ├── css_bundle.py         # Сборка /css/tool-bundle/<id>.css (hub, grabcam, вкладки)
│   ├── db/                   # SQLite: история запусков
│   ├── settings_keys.py      # Ключи из .env / настроек
│   └── tools/
│       ├── base.py           # ToolBase
│       ├── registry.py       # Список инструментов TOOLS
│       └── tool_<id>.py      # Один модуль на инструмент
├── static/
│   ├── index.html            # Хаб
│   ├── domain/               # Автономная страница «Домен»
│   ├── username/             # Автономная страница «Username»
│   ├── photo/                # Автономная страница «Фото»
│   ├── p/<tool_id>/          # Вкладки: index.html + page.js
│   ├── css/
│   │   ├── variables.css, layout.css, tools.css, proba-theme.css, hub-only.css
│   │   └── tools/packs/      # Хвосты бандлов: _shared/, ai-agent/, …
│   └── js/
│       ├── app-hub.js, app-core.js, header-env.js, header-ui.js
│       └── tools/tool-*.js   # Логика панелей (часть страниц подключает из /js/tools/)
├── tools/                    # Внешние и встроенные CLI (grabcam, maigret, subfinder, …)
└── scripts/push-github.sh    # Вспомогательный push на GitHub (см. §13)
```

**Важно:** панель Grabcam раздаётся также из `tools/grabcam/panel/` (маршрут в `app.py`).

---

## 5. Установка и запуск

**Требования:** Python **3.10+** рекомендован (как минимум совместим с Flask 3 и зависимостями из `requirements.txt`). ОС: Linux (в т.ч. Kali), Windows, macOS.

### Быстрый старт

```bash
cd "/путь/к/OSINT HTML V3.0"
python3 run.py
```

Скрипт переходит в корень проекта и при необходимости ставит зависимости из `requirements.txt`. В браузере: **http://127.0.0.1:5000**

### Ручной запуск (через venv)

```bash
cd "/путь/к/OSINT HTML V3.0"
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
=======
## Репозиторий и Git

- **Версионирование:** проект в Git — можно откатывать изменения и вести историю.
- **Секреты:** не коммить `.env`, ключи API и папку `tools/grabcam/Photo/` (см. `.gitignore`).
- **Первый коммит и отправка на GitHub** (после установки [Git](https://git-scm.com/) и входа в GitHub):

```bash
cd "путь/к/OSINT HTML V2.0"
git init
git add .
git commit -m "Initial commit: OSINT Panel"
# Создайте пустой репозиторий на https://github.com/new (без README, если уже есть локальный)
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПО.git
git push -u origin main
```

С [GitHub CLI](https://cli.github.com/) (`gh`): `gh repo create ИМЯ_РЕПО --public --source=. --remote=origin --push`.

**Скрипт из проекта:** после создания пустого репозитория на GitHub выполните из корня проекта: `./scripts/push-github.sh ВАШ_ЛОГИН ИМЯ_РЕПО` (потребуется ввести логин/токен при `git push`, если не настроен credential helper).

**Дымовой чек после правок:** `python run.py` → открыть http://127.0.0.1:5000 → переключить вкладку Grabcam (если используете).

**Вложенные `.git` в `tools/*`:** если раньше клонировали инструменты отдельно, в папках мог остаться свой репозиторий. Для одного общего репозитория OSINT Panel удалите `tools/<инструмент>/.git` (кроме случаев, когда нужен именно submodule). Если `tools/shodan-python` принадлежит `root`, выполните: `sudo chown -R "$USER" tools/shodan-python`, затем `rm -rf tools/shodan-python/.git` и снова `git add .`.

---

**Единая панель для разведки в открытых источниках.** Один веб-интерфейс для сбора данных по доменам, email, именам пользователей и утечкам.

- **Поиск по домену:** WHOIS, DNS, SSL, crt.sh, theHarvester, Subfinder  
- **Поиск по имени пользователя:** Sherlock, Maigret, Social Analyzer, Blackbird  
- **Email:** Holehe, h8mail (утечки), theHarvester  
- **Прочее:** анонимные SMS, Google OSINT, Grabcam (образовательные цели)

Стек: HTML/CSS/JS (фронт), Python (Flask), SQLite. Каждый инструмент — отдельный модуль в `backend/tools/`, можно подключать и дорабатывать по одному.

## Запуск

**Запуск:**

```bash
python run.py
```
или `python3 run.py`. Скрипт переходит в папку проекта, при необходимости ставит зависимости. После запуска открой в браузере: **http://127.0.0.1:5000**

Ручной запуск (если нужно):

```bash
cd "путь/к/OSINT HTML"
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
>>>>>>> 0c2e67f47626b22a56fe2d4519cb1daeba13e4d6
pip install -r requirements.txt
python backend/app.py
```

<<<<<<< HEAD
На системах с *externally-managed-environment* (например Kali) **обязательно** используйте виртуальное окружение (`venv`), а не установку пакетов в системный Python.

**Доступ из LAN:** `run.py` слушает `0.0.0.0:5000`; на другом устройстве откройте `http://<IP-ПК>:5000` и при необходимости откройте порт в фаерволе.

---

## 6. Системные зависимости (не pip)

Комментарии в начале `requirements.txt` дублируют смысл; кратко:

| Компонент | Зачем |
|-----------|--------|
| **exiftool** | Разбор метаданных изображений (где подключено в пайплайне фото) |
| **tesseract-ocr** (+ языки **eng**/**rus**) | OCR; при нестандартном пути: `TESSERACT_CMD` |
| **php** | Часть сценариев Grabcam / вспомогательных файлов |
| **go** | Сборка **Subfinder** и **dnsx** из исходников в `tools/` |

Пример (Debian/Kali):

```bash
sudo apt install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus
```

---

## 7. Go-инструменты (Subfinder, dnsx)

Если в системе нет `go`, установите его ([официальный дистрибутив](https://go.dev/dl/) или `apt install golang-go`). Архив `go*.tar.gz` в корне **не обязан** быть в Git (см. `.gitignore`); локально можно распаковать в `/usr/local` и добавить `export PATH=$PATH:/usr/local/go/bin`.

Сборка Subfinder (из корня репозитория панели):
=======
(На Kali/Linux с externally-managed Python лучше сначала создать venv: `python3 -m venv venv`, затем запускать `./run.sh`.)

**Перенос на другой компьютер:** скопируй папку проекта на другой ноутбук — там нужно заново поднять окружение: Python 3, `python3 -m venv venv`, `pip install -r requirements.txt`. Папку `venv/` можно не копировать (она привязана к пути и ОС). Go-инструменты (Subfinder, dnsx): либо установи Go на новом ПК и собери бинарники (`go build ...` в `tools/subfinder` и `tools/dnsx`), либо скопируй уже собранные исполняемые файлы `subfinder` и `dnsx` в соответствующие папки `tools/subfinder/` и `tools/dnsx/` (на той же ОС и архитектуре). После этого `python run.py` будет работать так же.

**Зависимости:** Все пакеты перечислены в `requirements.txt`. `flask-cors` нужен, если панель открывают с другого домена/порта или к API обращаются извне (например, отдельный фронт или скрипты). При работе «одним сервером» (HTML и API с одного адреса) запросы и так проходят, но CORS не мешает.

**Презентация:**  
- Короткая: `python create_presentation.py` → `OSINT_Panel_презентация.pptx`.  
- Крупная (план проекта, студенческая защита): `python create_presentation_plan.py` → `OSINT_Panel_презентация_план.pptx`. Используются изображения из папки `presentation_assets/` (osint_cover.png, osint_actual.png, osint_dashboard.png, osint_tech.png). Требуется `pip install python-pptx`.

## Как добавить новый инструмент

### 1. Backend (Python)

- Создай файл `backend/tools/tool_<id>.py` (например `tool_sherlock.py`).
- Класс должен наследовать `ToolBase` из `backend/tools/base.py` и реализовать: `tool_id`, `name`, `run(params)`.
- В `backend/tools/registry.py`: добавь импорт и строку в список `TOOLS`.

Остальные файлы бэкенда не меняй.

### 2. Frontend (HTML)

- В `static/index.html`: добавь блок панели и подключи свой CSS (если нужен):
  - `<div id="panel-<id>" class="tool-panel" data-tool-id="<id>"></div>`
  - `<link rel="stylesheet" href="/css/tools/tool-<id>.css">`

### 3. Frontend (JS)

- Создай `static/js/tools/tool-<id>.js`.
- Экспортируй функцию `initPanel(container)` — в ней разметка и обработчики только для этого инструмента.
- Вызов API через `apiRun(toolId, params)` из `app.js`.

### 4. Frontend (CSS, по желанию)

- Создай `static/css/tools/tool-<id>.css` для стилей только этой панели.

## Структура

```
backend/
  app.py           # Маршруты API, без логики инструментов
  db/              # SQLite: database.py, init_db, save_run, get_run_history
  tools/
    base.py        # Интерфейс ToolBase
    registry.py    # Список инструментов (здесь добавлять новые)
    tool_anonsms.py
    tool_<id>.py   # По одному файлу на инструмент

static/
  index.html
  css/
    variables.css  # Общие переменные
    layout.css     # Сайдбар + контент
    tools.css      # Общие стили форм/кнопок
    tools/tool-<id>.css
  js/
    app.js         # Загрузка инструментов, переключение панелей, apiRun
    tools/tool-<id>.js

data/
  osint_panel.db   # SQLite (создаётся автоматически)
```

## База данных

- Таблица `runs`: история запусков (tool_id, params_json, result_json, error_text, created_at).
- API: `GET /api/history?tool_id=...&limit=50`.

Все инструменты работают независимо; общее только API, БД и общий layout.

---

## Инструменты для клонирования с GitHub (поиск по домену / поддомены)

Можно добавить в папку `tools/` и интегрировать в панель через `backend/tools/tool_<id>.py` (запуск через subprocess или вызов API/CLI).

| Инструмент | Назначение | Клонирование |
|------------|------------|---------------|
| **Subfinder** | Поддомены (много источников) | `git clone https://github.com/projectdiscovery/subfinder.git tools/subfinder` |
| **dnsx** | DNS A/AAAA/CNAME по домену (уже в панели) | В проекте: `cd tools/dnsx && go build -buildvcs=false -o dnsx ./cmd/dnsx` |
| **Amass** | Перечисление поддоменов, разведка | `git clone https://github.com/owasp-amass/amass.git tools/amass` |
| **Assetfinder** | Поддомены (быстрый) | `git clone https://github.com/tomnomnom/assetfinder.git tools/assetfinder` |
| **Findomain** | Поддомены (API и сертификаты) | `git clone https://github.com/Findomain/Findomain.git tools/findomain` |
| **Httpx** (projectdiscovery) | Проверка HTTP/HTTPS, заголовки, технологии | `git clone https://github.com/projectdiscovery/httpx.git tools/httpx` |
| **Nuclei** | Сканирование уязвимостей по шаблонам | `git clone https://github.com/projectdiscovery/nuclei.git tools/nuclei` |
| **Gau** (GetAllUrls) | Сбор URL из архивов (Wayback и др.) | `git clone https://github.com/lc/gau.git tools/gau` |
| **Waybackurls** | URL из archive.org по домену | `git clone https://github.com/tomnomnom/waybackurls.git tools/waybackurls` |
| **theHarvester** | Уже в проекте (pip), email/поддомены/хосты | — |
| **Holehe / h8mail** | Уже в проекте (раздел «Google OSINT») | — |
| **Social Analyzer** | Поиск по имени на 900+ сайтах (уже в панели) | Зависимости в главном `requirements.txt` |
| **Blackbird** | Поиск по имени на 600+ платформах WhatsMyName (уже в панели) | Зависимости в главном `requirements.txt` |

После клонирования: собрать бинарник (Go) или установить зависимости (Python) по инструкции в репозитории. Все Python-зависимости инструментов (в т.ч. Social Analyzer) собраны в корневом `requirements.txt`. В панели вызывать через `subprocess` в `backend/tools/tool_<id>.py`, передавая домен и обрабатывая вывод.

---

## Установка Go (для Subfinder и других Go-инструментов)

Если при сборке Subfinder появляется `command not found: go`, установите Go.

**Вариант 1 — из архива в корне проекта** (если есть `go1.*.linux-amd64.tar.gz`):

```bash
cd "путь/к/OSINT HTML"
sudo tar -C /usr/local -xzf go1.*.linux-amd64.tar.gz
```

Добавьте в `~/.zshrc` или `~/.bashrc`:

```bash
export PATH=$PATH:/usr/local/go/bin
```

Затем выполните `source ~/.zshrc` (или перезайдите в терминал) и соберите Subfinder (нужен интернет для загрузки зависимостей):
>>>>>>> 0c2e67f47626b22a56fe2d4519cb1daeba13e4d6

```bash
cd tools/subfinder
go build -buildvcs=false -o subfinder ./cmd/subfinder
```

<<<<<<< HEAD
Аналогично для `tools/dnsx` (см. README внутри репозитория dnsx). Флаг `-buildvcs=false` снимает ошибки при отсутствии корректного git metadata в каталоге.

**Перенос на другой ПК:** папку `venv/` копировать не нужно; скопируйте проект и заново выполните `pip install -r requirements.txt`. Go-бинарники собирайте на целевой ОС/архитектуре или копируйте готовые исполняемые файлы в `tools/subfinder/` и `tools/dnsx/`.

---

## 8. База данных и API истории

- Таблица **`runs`**: история запусков (`tool_id`, параметры, результат, ошибка, время).
- Пример: **`GET /api/history?tool_id=...&limit=50`**.

Файлы БД не должны попадать в Git, если содержат чувствительные результаты (см. `.gitignore`: `*.db`, `data/`).

---

## 9. Как добавить новый инструмент

### 9.1. Backend

1. Создайте `backend/tools/tool_<id>.py` с классом от **`ToolBase`** (`backend/tools/base.py`): поля `tool_id`, `name`, метод `run(params)`.
2. Зарегистрируйте в **`backend/tools/registry.py`**: импорт + элемент в списке **`TOOLS`**.

### 9.2. Вкладка с бандлом CSS (как у существующих `/p/<id>/`)

1. Каталог **`static/p/<id>/`**: `index.html` + `page.js` (подключение по аналогии с `static/p/google-osint/`).
2. В `<head>`: **`/css/tool-bundle/<id>.css`**.
3. В **`backend/css_bundle.py`** добавьте ключ **`<id>`** в словарь **`TOOL_CSS_TAILS`** и файлы в **`static/css/tools/packs/<id>/`** (при необходимости общие стили из **`packs/_shared/`**).
4. Маршрут **`/p/<id>/`** уже обслуживается Flask (`app.py`); для редиректа без слэша используется `/p/<id>` → `/p/<id>/`.
5. Карточку/ссылку на хабе добавьте в **`static/js/app-hub.js`** (и при необходимости дублируйте пункт в шапках страниц по образцу существующих HTML).

### 9.3. Автономная страница (как Домен / Username / Фото)

Отдельный каталог под **`static/<имя>/`** (`index.html`, `css/`, `js/`), **без** записи в `TOOL_CSS_TAILS`, если не используете общий бандл.

### 9.4. Frontend-логика

- Для вкладок: модуль **`static/js/tools/tool-<id>.js`** или логика в **`static/p/<id>/page.js`** — смотрите, как сделано у соседних инструментов.
- Вызов API: функции вроде **`apiRun`** из общего кода (`app-core.js` / страница-обёртка).

---

## 10. Дополнительные инструменты (клонирование в `tools/`)

Ниже — **опциональные** CLI; панель может быть расширена обёртками `tool_<id>.py`.

| Инструмент | Назначение | Клонирование |
|------------|------------|--------------|
| **Subfinder** | Поддомены | `git clone https://github.com/projectdiscovery/subfinder.git tools/subfinder` |
| **dnsx** | DNS-запросы | репозиторий в `tools/dnsx`, сборка `go build … ./cmd/dnsx` |
| **Amass** | Поддомены, разведка | `git clone https://github.com/owasp-amass/amass.git tools/amass` |
| **Assetfinder** | Поддомены | `git clone https://github.com/tomnomnom/assetfinder.git tools/assetfinder` |
| **Findomain** | Поддомены | `git clone https://github.com/Findomain/Findomain.git tools/findomain` |
| **httpx** | HTTP-пробы | `git clone https://github.com/projectdiscovery/httpx.git tools/httpx` |
| **Nuclei** | Шаблонные проверки | `git clone https://github.com/projectdiscovery/nuclei.git tools/nuclei` |
| **gau** | URL из архивов | `git clone https://github.com/lc/gau.git tools/gau` |
| **waybackurls** | Wayback | `git clone https://github.com/tomnomnom/waybackurls.git tools/waybackurls` |

theHarvester, Holehe, h8mail, Social Analyzer, Blackbird уже учтены в зависимостях или дереве проекта — см. `registry.py` и `requirements.txt`.

---

## 11. Презентации (опционально)

В корне репозитория **может не быть** скриптов `create_presentation.py` / `create_presentation_plan.py`. Если вы их добавите, типичная схема: `pip install python-pptx`, иллюстрации в **`presentation_assets/`**, выходные `OSINT_Panel_презентация*.pptx` не коммитить (см. `.gitignore`). Краткое описание идеи — в **`README_PANEL.md`**.

---

## 12. Этика и правовая ответственность

- Используйте панель **только в законных целях**: свои системы, явное согласие владельца данных, рамки учебного задания или контракта.
- **Не** используйте функции для несанкционированного доступа, сбора персональных данных третьих лиц без правового основания, преследования и т.п.
- Соблюдайте **ToS** внешних сервисов и ограничения по частоте запросов.
- Репозиторий и авторы **не несут ответственности** за неправомерное использование кода.

---

## 13. Для разработчиков: Git и GitHub

- **Секреты:** не коммить **`.env`**, ключи API, каталог **`tools/grabcam/Photo/`**, захваты форм и прочие чувствительные артефакты — см. **`.gitignore`**.
- **Вложенные `.git` в `tools/*`:** если клонировали инструмент отдельно, удалите вложенный `.git`, если хотите единый репозиторий панели (кроме осознанных submodule).
- **shodan-python:** при проблемах с правами см. комментарий в `.gitignore`.

Первичная отправка на GitHub (пустой репозиторий без README на сайте):

```bash
cd "/путь/к/OSINT HTML V3.0"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПО.git
git push -u origin main
```

Для токена нужны права **записи в Contents** (fine-grained) или классическая область **`repo`**.

**Скрипт:** `./scripts/push-github.sh ВАШ_ЛОГИН ИМЯ_РЕПО` — после создания пустого репозитория на GitHub.

**Проверка после правок:** `python run.py` → http://127.0.0.1:5000 → пройти по основным разделам и одному тяжёлому инструменту (например Grabcam, если используете).

---

## 14. Лицензия и контакты

Укажите лицензию проекта (файл `LICENSE` при наличии) и контакт для вопросов по коду.

**© OSINT Panel** — учебный и исследовательский инструмент; развивайте и форкайте с соблюдением законодательства вашей юрисдикции.
=======
Флаг `-buildvcs=false` отключает проверку git при сборке и избегает ошибки «error obtaining VCS status».

**Если при сборке или копировании появляется «permission denied»** (каталог `tools/subfinder` принадлежит другому пользователю), соберите бинарник во временный каталог и скопируйте с правами:

```bash
cd tools/subfinder
go build -buildvcs=false -o /tmp/subfinder_binary ./cmd/subfinder
sudo cp /tmp/subfinder_binary "$(pwd)/subfinder"
sudo chown $USER:$USER subfinder
chmod +x subfinder
```

Либо верните владение каталогу: `sudo chown -R $USER:$USER tools/subfinder`, затем снова выполните `go build -buildvcs=false -o subfinder ./cmd/subfinder`.

**Вариант 2 — через пакетный менеджер (Kali/Debian):**

```bash
sudo apt update
sudo apt install golang-go
cd tools/subfinder
go build -o subfinder ./cmd/subfinder
```
>>>>>>> 0c2e67f47626b22a56fe2d4519cb1daeba13e4d6
