# Date: 12/28/2018
# Author: Mohamed
# Description: Constants

import os

# User agents: реальные браузеры снижают риск блокировки; боты оставлены как запасной вариант
user_agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
]

# Browser
header = {
    "x-ig-app-id": "936619743392459",
    "x-instagram-ajax": "2f6bf8b37c04",
    "x-requested-with": "XMLHttpRequest",
    "referer": "https://www.instagram.com/",
    "content-type": "application/x-www-form-urlencoded",
}

username_field = "username"
password_field = "enc_password"
home_url = "https://www.instagram.com/"
login_url = "https://www.instagram.com/accounts/login/ajax/"

browser_data = {
    "header": header,
    "home_url": home_url,
    "login_url": login_url,
    "username_field": username_field,
    "password_field": password_field,
}

# Login
fetch_time = (10, 15)
response_codes = {"succeed": 0, "failed": 1, "locked": -1}

# Limits
max_bad_proxies = 256
max_time_to_wait = 18
max_bots_per_proxy = 16

# Misc
debug = False
# Файл, куда пишутся только реально найденные пары (логин/пароль). Раньше ошибочно записывались ответы с checkpoint_url — исправлено в browser.check_response.
credentials = "accounts.txt"
# Режимы: 0=32 потока, 1=16, 2=8, 3=4 (меньше потоков — стабильнее, меньше блокировок)
modes = {0: 32, 1: 16, 2: 8, 3: 4}

# Database
db_dir = "database"
db_database = "database.db"
db_path = os.path.join(db_dir, db_database)

if not os.path.exists(db_dir):
    os.mkdir(db_dir)
