#!/bin/bash
# Установка Go из архива go1.*.linux-amd64.tar.gz в корне проекта.
# После запуска добавьте в ~/.zshrc: export PATH=$PATH:/usr/local/go/bin

set -e
cd "$(dirname "$0")"
TAR=$(ls go1.*.linux-amd64.tar.gz 2>/dev/null | head -1)
if [ -z "$TAR" ]; then
  echo "Архив go1.*.linux-amd64.tar.gz не найден в $(pwd)"
  echo "Скачайте с https://go.dev/dl/ и положите в корень проекта."
  exit 1
fi
echo "Распаковка $TAR в /usr/local..."
sudo tar -C /usr/local -xzf "$TAR"
echo "Готово. Добавьте в ~/.zshrc или ~/.bashrc:"
echo "  export PATH=\$PATH:/usr/local/go/bin"
echo "Затем: source ~/.zshrc"
echo "Сборка Subfinder (нужен интернет): cd tools/subfinder && go build -buildvcs=false -o subfinder ./cmd/subfinder"
