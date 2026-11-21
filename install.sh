#!/usr/bin/env bash
# OSINT Panel installer for Kali Linux / Debian / Ubuntu.
# Safe to re-run: reuses the existing venv and never overwrites user data or .env.

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${ROOT_DIR}/venv"
WITH_OPTIONAL=0
NO_APT=0

usage() {
  cat <<'EOF'
OSINT Panel — установка

Использование:
  bash install.sh [параметры]

Параметры:
  --with-optional  Дополнительно установить OCR, EXIF, QR, PHP, SSH и Go-пакеты
  --no-apt         Не использовать apt (только создать venv и установить Python-зависимости)
  -h, --help       Показать эту справку

Установщик не удаляет venv, .env, data/ или базы SQLite.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --with-optional) WITH_OPTIONAL=1 ;;
    --no-apt) NO_APT=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Неизвестный параметр: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

fail() {
  echo "[ОШИБКА] $*" >&2
  exit 1
}

log() { printf '\n\033[1;34m[OSINT Panel]\033[0m %s\n' "$*"; }

[[ -f "${ROOT_DIR}/requirements.txt" && -f "${ROOT_DIR}/run.py" ]] || fail "Запусти установщик из корневого каталога репозитория."

command -v python3 >/dev/null 2>&1 || fail "Python 3 не найден. Установи python3."
PYTHON_VERSION="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' \
  || fail "Нужен Python 3.10 или новее. Обнаружен: ${PYTHON_VERSION}"

if [[ "$NO_APT" -eq 0 ]]; then
  [[ -r /etc/os-release ]] || fail "Не удалось определить дистрибутив Linux."
  . /etc/os-release
  case "${ID:-}" in
    kali|debian|ubuntu|linuxmint) ;;
    *) fail "Поддерживаются Kali Linux, Debian и Ubuntu. Для другой ОС используй --no-apt." ;;
  esac

  if [[ "$(id -u)" -eq 0 ]]; then
    SUDO=()
  elif command -v sudo >/dev/null 2>&1; then
    SUDO=(sudo)
  else
    fail "Для установки системных пакетов нужен sudo или запуск от root. Либо используй --no-apt."
  fi

  log "Обновляю индекс apt и устанавливаю базовые пакеты."
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y git python3 python3-venv python3-pip

  if [[ "$WITH_OPTIONAL" -eq 1 ]]; then
    log "Устанавливаю дополнительные системные утилиты."
    "${SUDO[@]}" apt-get install -y \
      tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus \
      libimage-exiftool-perl libzbar0 php-cli openssh-client golang-go
  fi
fi

if [[ ! -d "$VENV_DIR" ]]; then
  log "Создаю виртуальное окружение Python."
  python3 -m venv "$VENV_DIR"
else
  log "Использую существующее виртуальное окружение: $VENV_DIR"
fi

VENV_PYTHON="${VENV_DIR}/bin/python"
[[ -x "$VENV_PYTHON" ]] || fail "В виртуальном окружении не найден Python: $VENV_PYTHON"

log "Обновляю pip и устанавливаю зависимости проекта."
"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install -r "${ROOT_DIR}/requirements.txt"

log "Проверяю основные Python-зависимости."
"$VENV_PYTHON" - <<'PY'
import flask
import flask_cors
import requests
print("Flask:", flask.__version__ if hasattr(flask, "__version__") else "installed")
print("Flask-CORS: installed")
print("Requests: installed")
PY

log "Установка завершена."
cat <<EOF

Следующий запуск:
  cd "$ROOT_DIR"
  source venv/bin/activate
  python run.py

Затем открой в браузере:
  http://127.0.0.1:5000

Примечания:
  - .env, data/ и базы данных не изменялись.
  - Необязательные системные программы устанавливаются только с --with-optional.
  - Для повторной установки достаточно снова выполнить: bash install.sh
EOF
