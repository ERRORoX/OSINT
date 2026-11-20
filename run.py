#!/usr/bin/env python3
"""
Главный файл запуска OSINT Panel.
Обычный запуск: python3 run.py
Режим supervisor автоматически поднимает сервер повторно после установки обновления.
"""
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


def ensure_deps():
    """Проверяет базовые зависимости; устанавливает requirements только при их отсутствии."""
    try:
        import flask  # noqa: F401
        import flask_cors  # noqa: F401
    except ImportError:
        print("Устанавливаю зависимости проекта...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])


def run_worker():
    sys.path.insert(0, os.path.join(ROOT, "backend"))
    from app import app
    port = int(os.environ.get("OSINT_PANEL_PORT", "5000"))
    print("Панель запущена: http://127.0.0.1:{}".format(port))
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)


def main():
    ensure_deps()
    if "--worker" in sys.argv:
        run_worker()
        return

    # Supervisor остаётся запущенным, пока рабочий Flask-процесс перезапускается.
    while True:
        worker = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--worker"])
        code = worker.wait()
        if code != 75:
            if code:
                print("Сервер завершился с кодом {}.".format(code))
            break
        print("Обновление установлено. Перезапускаю OSINT Panel...")
        time.sleep(0.8)


if __name__ == "__main__":
    main()
