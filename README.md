# OSINT Panel

Веб-панель для **легитимной** разведки в открытых источниках (OSINT): домены, имена пользователей, email, фото, вспомогательные инструменты, история запусков.  
**Стек:** Python 3 (Flask), HTML/CSS/JS, SQLite. **UI:** версия 3.x — хаб, отдельные страницы, CSS-бандлы.

| | |
|---|---|
| **Репозиторий** | [github.com/ERRORoX/OSINT](https://github.com/ERRORoX/OSINT) |
| **Ветка по умолчанию** | `main` |
| **Точка входа** | `run.py` → Flask на порту **5000** |

*Шапку для учебного проекта (вуз, группа, ФИО, год, email руководителя) можно добавить под таблицей.*

---

## Содержание

1. [Обзор и возможности](#1-обзор-и-возможности)  
2. [Быстрый старт (3 шага)](#2-быстрый-старт-3-шага)  
3. [Требования к системе](#3-требования-к-системе)  
4. [Установка и запуск (подробно)](#4-установка-и-запуск-подробно)  
5. [Доступ из локальной сети (LAN)](#5-доступ-из-локальной-сети-lan)  
6. [Маршруты интерфейса](#6-маршруты-интерфейса)  
7. [Архитектура репозитория](#7-архитектура-репозитория)  
8. [Системные утилиты (не pip)](#8-системные-утилиты-не-pip)  
9. [Go: Subfinder и dnsx](#9-go-subfinder-и-dnsx)  
10. [База данных и API истории](#10-база-данных-и-api-истории)  
11. [Добавление нового инструмента (чеклист)](#11-добавление-нового-инструмента-чеклист)  
12. [Опциональные CLI в `tools/`](#12-опциональные-cli-в-tools)  
13. [Git и GitHub](#13-git-и-github)  
14. [Этика и ответственность](#14-этика-и-ответственность)  
15. [Устранение неполадок (FAQ)](#15-устранение-неполадок-faq)  
16. [Лицензия](#16-лицензия)

---

## 1. Обзор и возможности

**Назначение:** собирать данные из **открытых** источников в рамках закона и условий сервисов; учебные и исследовательские сценарии.

| Раздел | URL | Кратко |
|--------|-----|--------|
| Хаб | `/` | Карточки инструментов |
| Домен | `/domain/` | WHOIS, DNS, поддомены и др. |
| Username | `/username/` | Sherlock, Maigret, Social Analyzer, Blackbird и др. |
| Фото | `/photo/` | Поиск, OCR, QR, AI (по настройке) |
| Вкладки инструментов | `/p/<id>/` | `google-osint`, `ai-agent`, `instagram-bruter`, `anonsms`, `grabcam`, `history`, `settings` |
| История | `/p/history/` | Сохранённые запуски |
| Настройки | `/p/settings/` | API-ключи (не хранить в Git) |

**Стили:** для вкладок с хаба подключается **`/css/tool-bundle/<tool_id>.css`** (сборка в `backend/css_bundle.py` из `static/css/tools/packs/…`). Страницы **Домен**, **Username**, **Фото** используют свои каталоги под `static/`.

---

> **Установка в Kali Linux:** подробная инструкция с разделением обязательных и дополнительных зависимостей находится в [docs/INSTALLATION_RU.md](docs/INSTALLATION_RU.md). Не все системные утилиты нужны для запуска панели.\n\n## 2. Быстрый старт (3 шага)

### Шаг 1 — получить код

```bash
git clone https://github.com/ERRORoX/OSINT.git
cd OSINT
```

(Если репозиторий уже склонирован — перейдите в его каталог.)

### Шаг 2 — запустить панель

```bash
python3 run.py
```

При первом запуске `run.py` при необходимости установит зависимости из `requirements.txt` в текущий интерпретатор Python.

> **Kali / PEP 668:** если система запрещает `pip install` глобально, используйте **Шаг 2 альтернативный** из [§4](#4-установка-и-запуск-подробно).

### Шаг 3 — открыть в браузере

1. Откройте **http://127.0.0.1:5000**  
2. Убедитесь, что страница хаба загружается  
3. Перейдите в **Домен** или **Username** и выполните тестовый запрос на **своих** данных

---

## 3. Требования к системе

| Компонент | Минимум / рекомендация |
|-----------|-------------------------|
| **Python** | 3.10+ (совместимость с Flask 3 и зависимостями из `requirements.txt`) |
| **ОС** | Linux (в т.ч. Kali), Windows, macOS |
| **Браузер** | современный Chromium / Firefox / Safari |
| **Сеть** | для внешних API и CLI-инструментов, обращающихся в интернет |
| **Диск** | с запасом под клоны `tools/` и кэши инструментов |

Архивы **`go*.tar.gz`** в корне и в `tools/**/` **не должны** попадать в Git (см. `.gitignore`); при необходимости держите их только локально.

---

## 4. Установка и запуск (подробно)

### 4.1. Рекомендуемый путь: виртуальное окружение

**Шаг 1.** Создать и активировать `venv`:

```bash
cd /путь/к/OSINT
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
```

**Шаг 2.** Установить зависимости:

```bash
pip install -r requirements.txt
```

**Шаг 3.** Запуск:

```bash
python run.py
# или
python backend/app.py
```

Оба способа поднимают сервер; `run.py` дополнительно подсказывает URL в LAN.

### 4.2. Запуск без venv (только если политика ОС позволяет)

```bash
cd /путь/к/OSINT
python3 run.py
```

Если `pip install` из `run.py` падает с ошибкой *externally-managed-environment* — переходите к **§4.1**.

### 4.3. Перенос на другой компьютер

1. Скопировать каталог проекта (без `venv/`, без `data/` с секретами).  
2. На новой машине: `python3 -m venv venv` → `pip install -r requirements.txt`.  
3. При необходимости заново собрать или скопировать Go-бинарники **для той же ОС и архитектуры** (`tools/subfinder/subfinder`, `tools/dnsx/dnsx`).

---

## 5. Доступ из локальной сети (LAN)

1. Запустите панель (`run.py` слушает `0.0.0.0:5000`).  
2. Узнайте IP ПК: `ip a`, `ipconfig` или подсказку в консоли после старта.  
3. На другом устройстве откройте `http://<IP-ПК>:5000`.  
4. При необходимости откройте порт **5000** в фаерволе.

---

## 6. Маршруты интерфейса

- **`/`** — хаб  
- **`/domain/`**, **`/username/`**, **`/photo/`** — автономные приложения в `static/`  
- **`/p/<tool_id>/`** — страница инструмента; **`/p/<tool_id>`** редиректит на URL со слэшем  
- **`/css/tool-bundle/<tool_id>.css`** — собранный CSS (см. `BUNDLE_TOOL_IDS` в `backend/css_bundle.py`)  
- **`/api/...`** — REST API (история, запуск инструментов, настройки — см. `backend/app.py`)

---

## 7. Архитектура репозитория

```
OSINT/
├── run.py                 # Запуск, порт 5000
├── requirements.txt
├── backend/
│   ├── app.py             # Маршруты Flask, API, статика
│   ├── css_bundle.py      # Бандлы /css/tool-bundle/<id>.css
│   ├── db/                # SQLite, история запусков
│   ├── settings_keys.py   # Ключи из .env
│   └── tools/
│       ├── base.py        # ToolBase
│       ├── registry.py    # TOOLS
│       └── tool_<id>.py
├── static/
│   ├── index.html         # Хаб
│   ├── domain/  username/  photo/
│   ├── p/<tool_id>/       # index.html + page.js
│   ├── css/tools/packs/   # Токены и панели для бандлов
│   └── js/                # app-hub.js, app-core.js, header-*.js, tools/*.js
├── tools/                 # Maigret, grabcam, subfinder, dnsx, …
└── scripts/push-github.sh
```

Статика панели **Grabcam** дополнительно отдаётся из `tools/grabcam/panel/` (см. маршруты в `app.py`).

---

## 8. Системные утилиты (не pip)

Комментарии в начале `requirements.txt` — источник правды; краткий чеклист:

| Утилита | Назначение |
|---------|------------|
| **tesseract-ocr** (+ `eng`, `rus`) | OCR; переменная `TESSERACT_CMD` при нестандартном пути |
| **exiftool** | Метаданные изображений (в цепочке фото) |
| **php** | Часть сценариев Grabcam |
| **go** | Сборка Subfinder / dnsx |

Пример (Debian/Kali):

```bash
sudo apt update
sudo apt install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus
```

---

## 9. Go: Subfinder и dnsx

### Шаг 1 — установить Go

- Сайт: [go.dev/dl](https://go.dev/dl/) **или** `sudo apt install golang-go` (версия может быть ниже).

### Шаг 2 — проверить `PATH`

Должны выполняться команды `go version`. При установке из архива в `/usr/local/go`:

```bash
export PATH=$PATH:/usr/local/go/bin
```

### Шаг 3 — собрать Subfinder

```bash
cd tools/subfinder
go build -buildvcs=false -o subfinder ./cmd/subfinder
```

Флаг **`-buildvcs=false`** убирает ошибки вида *error obtaining VCS status* при «грязном» каталоге.

### Шаг 4 — собрать dnsx

```bash
cd ../dnsx
go build -buildvcs=false -o dnsx ./cmd/dnsx
```

(Уточните путь к `main` в README внутри репозитория dnsx при отличиях.)

### Если «permission denied» в `tools/subfinder`

```bash
cd tools/subfinder
go build -buildvcs=false -o /tmp/subfinder_binary ./cmd/subfinder
sudo cp /tmp/subfinder_binary "$(pwd)/subfinder"
sudo chown "$USER:$USER" subfinder
chmod +x subfinder
```

Либо: `sudo chown -R "$USER:$USER" tools/subfinder` и повторить сборку.

---

## 10. База данных и API истории

- Таблица **`runs`**: `tool_id`, параметры, результат, ошибка, время.  
- Пример запроса: **`GET /api/history?tool_id=...&limit=50`**

Файлы `*.db` и каталог **`data/`** не коммитьте, если внутри чувствительные данные (см. `.gitignore`).

---

## 11. Добавление нового инструмента (чеклист)

### Backend

1. Файл `backend/tools/tool_<id>.py`, класс от **`ToolBase`** (`tool_id`, `name`, `run(params)`).  
2. Регистрация в **`backend/tools/registry.py`**: импорт + строка в **`TOOLS`**.

### Вкладка `/p/<id>/` с CSS-бандлом

1. Каталог **`static/p/<id>/`**: `index.html` + `page.js` (образец: `static/p/google-osint/`).  
2. В HTML: `<link rel="stylesheet" href="/css/tool-bundle/<id>.css">`.  
3. В **`backend/css_bundle.py`**: ключ `<id>` в **`TOOL_CSS_TAILS`** и файлы в **`static/css/tools/packs/<id>/`**.  
4. В **`static/js/app-hub.js`**: карточка / ссылка на инструмент.  
5. При необходимости — пункт в шапке других страниц по аналогии с существующими HTML.

### Автономная страница (как Домен / Username / Фото)

Отдельный каталог **`static/<имя>/`** с собственными `css/` и `js/`; запись в `TOOL_CSS_TAILS` не обязательна.

### Вызов API с фронта

Используйте общие функции (например **`apiRun`**) из **`static/js/app-core.js`** или локальную обёртку в `page.js` — смотрите соседние инструменты.

---

## 12. Опциональные CLI в `tools/`

Интеграция в панель — через новый **`tool_<id>.py`** и `subprocess`.

| Инструмент | Назначение | Клонирование |
|------------|------------|----------------|
| Subfinder | Поддомены | `git clone https://github.com/projectdiscovery/subfinder.git tools/subfinder` |
| dnsx | DNS | уже в дереве; сборка `go build` |
| Amass | Поддомены | `git clone https://github.com/owasp-amass/amass.git tools/amass` |
| Assetfinder | Поддомены | `git clone https://github.com/tomnomnom/assetfinder.git tools/assetfinder` |
| Findomain | Поддомены | `git clone https://github.com/Findomain/Findomain.git tools/findomain` |
| httpx | HTTP-пробы | `git clone https://github.com/projectdiscovery/httpx.git tools/httpx` |
| Nuclei | Шаблоны | `git clone https://github.com/projectdiscovery/nuclei.git tools/nuclei` |
| gau | URL из архивов | `git clone https://github.com/lc/gau.git tools/gau` |
| waybackurls | Wayback | `git clone https://github.com/tomnomnom/waybackurls.git tools/waybackurls` |

theHarvester, Holehe, h8mail, Social Analyzer, Blackbird уже завязаны на текущий `requirements.txt` / `registry.py`.

---

## 13. Git и GitHub

**Не коммитить:** `.env`, ключи API, `tools/grabcam/Photo/`, `data/`, `venv/`, `*.db`, захваты форм — см. **`.gitignore`**.

**Вложенные репозитории:** если в `tools/<имя>/` остался `.git` от отдельного клона, удалите его для единого репозитория панели (если не используете submodule).

**Первый push:**

```bash
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПО.git
git push -u origin main
```

Для HTTPS нужен PAT с правом **записи в Contents** или классическая область **`repo`**. **Не публикуйте токены** в чатах и в коде; удобнее **SSH** (`git@github.com:USER/REPO.git`).

Скрипт: **`./scripts/push-github.sh ЛОГИН ИМЯ_РЕПО`**.

После правок: `python3 run.py` → smoke-тест основных разделов.

---

## 14. Этика и ответственность

- Используйте панель только **законно**: свои ресурсы, согласие субъекта данных, рамки учебной/договорной работы.  
- Не нарушайте **ToS** внешних сервисов; соблюдайте лимиты запросов.  
- Авторы репозитория **не отвечают** за злоупотребление кодом.

---

## 15. Устранение неполадок (FAQ)

| Проблема | Что сделать |
|----------|-------------|
| `externally-managed-environment` при `pip install` | Создать `venv` (§4.1), не ставить пакеты в системный Python. |
| `command not found: go` | Установить Go, проверить `PATH` (§9). |
| Ошибка VCS при `go build` | Добавить **`-buildvcs=false`**. |
| Порт 5000 недоступен с другого ПК | Фаервол, `host="0.0.0.0"` уже в `run.py`; проверить IP. |
| Нет OCR | Установить Tesseract и языки; при необходимости `TESSERACT_CMD`. |
| Пустой / битый CSS на вкладке | Проверить, что `<id>` есть в `TOOL_CSS_TAILS` и файлы лежат в `static/css/tools/packs/`. |
| Большие файлы в истории Git | Не коммитить `go*.tar.gz`; при уже отправленном мусоре — переписать историю (`git filter-repo`) и **force-push** (осознанно для всех клонов). |

---

## 16. Лицензия

Укажите в репозитории файл **`LICENSE`** при выборе лицензии.  
**© OSINT Panel** — учебный и исследовательский инструмент; использование — с соблюдением законодательства вашей юрисдикции.

---

## См. также

- **`README_PANEL.md`** — краткий дубль для панели; при расхождении с **`README.md`** приоритет у **этого файла**.
