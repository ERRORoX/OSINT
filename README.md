# OSINT Panel

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
pip install -r requirements.txt
python backend/app.py
```

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

```bash
cd tools/subfinder
go build -buildvcs=false -o subfinder ./cmd/subfinder
```

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
