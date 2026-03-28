#!/usr/bin/env bash
# Отправка репозитория на GitHub (после: создание пустого репо на https://github.com/new )
# Использование:
#   chmod +x scripts/push-github.sh
#   ./scripts/push-github.sh ВАШ_ЛОГИН ИМЯ_РЕПОЗИТОРИЯ
set -e
cd "$(dirname "$0")/.."
if [ -z "${1:-}" ] || [ -z "${2:-}" ]; then
  echo "Использование: $0 <github_username> <repo_name>"
  echo "Пример: $0 myuser osint-html-v2"
  exit 1
fi
USER="$1"
REPO="$2"
URL="https://github.com/${USER}/${REPO}.git"
if ! git remote get-url origin &>/dev/null; then
  git remote add origin "$URL"
else
  git remote set-url origin "$URL"
fi
git branch -M main
git push -u origin main
echo "Готово: $URL"
