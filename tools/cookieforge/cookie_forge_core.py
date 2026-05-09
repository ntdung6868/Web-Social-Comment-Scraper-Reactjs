import time
import json
import os
import random
import shutil
import tempfile
import atexit
from datetime import datetime
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException, TimeoutException

# --- CÁC HÀM HỖ TRỢ TỪ SCRAPER.PY ---

def random_sleep(min_sec=2.0, max_sec=3.5, stop_event=None):
    """Sleep ngẫu nhiên có check stop_event"""
    t = random.uniform(min_sec, max_sec)
    if stop_event:
        # Chia nhỏ thời gian sleep để check stop event liên tục
        steps = int(t * 10)
        for _ in range(steps):
            if stop_event.is_set(): return
            time.sleep(0.1)
    else:
        time.sleep(t)

def setup_driver():
    """Khởi tạo Driver với cấu hình Anti-Detect.

    Mỗi lần gọi tạo user-data-dir TẠM RIÊNG (`/tmp/cookieforge_xxx`) — tránh
    conflict với Chrome đang chạy hoặc với run trước → fix lỗi
    "invalid session id: session deleted" khi chạy lặp.
    """
    chrome_options = Options()

    # User-data-dir riêng cho mỗi run, dọn khi process exit
    user_data_dir = tempfile.mkdtemp(prefix="cookieforge_profile_")
    chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
    atexit.register(lambda: shutil.rmtree(user_data_dir, ignore_errors=True))

    # Tắt tiếng trình duyệt
    chrome_options.add_argument("--mute-audio")

    # 1. Tắt automation flags (Critical)
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')

    # 2. Cấu hình Performance & Docker compat
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--disable-infobars')
    chrome_options.add_argument('--force-color-profile=srgb')
    # Chống treo do tab bị throttle
    chrome_options.add_argument('--disable-background-timer-throttling')
    chrome_options.add_argument('--disable-renderer-backgrounding')

    # 3. User-Agent — bám sát Chrome stable mới (Chrome 130+)
    # UA cũ Chrome/120 có thể bị TikTok flag là "stale browser"
    chrome_options.add_argument(
        'user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
    )

    # 4. Setup Binary & Driver
    chrome_bin = os.environ.get("CHROME_BIN") or os.environ.get("GOOGLE_CHROME_BIN")
    if chrome_bin and os.path.exists(chrome_bin):
        chrome_options.binary_location = chrome_bin

    service = Service(ChromeDriverManager().install())
    if os.name == 'nt':
        service.creation_flags = 0x08000000

    driver = webdriver.Chrome(service=service, options=chrome_options)

    # Timeout dài hơn cho TikTok (default 300s thường quá ngắn cho cold load)
    driver.set_page_load_timeout(60)
    driver.set_script_timeout(30)

    # 5. Resize window 420px (TikTok mobile-like layout)
    try:
        driver.maximize_window()
        time.sleep(0.3)
        h = driver.get_window_size()["height"]
        driver.set_window_rect(x=0, y=0, width=420, height=h)
    except: pass

    # 6. CDP Command để ẩn dấu vết webdriver (mạnh hơn JS thường)
    try:
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            '''
        })
    except Exception:
        # Không critical — bỏ qua nếu CDP fail (Chrome version cũ)
        pass

    return driver


def safe_navigate(driver, url, log_func, max_attempts=3):
    """Navigate với retry. Chrome 147+ đôi khi crash renderer trong lần đầu — retry hồi phục."""
    last_err = None
    for attempt in range(1, max_attempts + 1):
        try:
            driver.get(url)
            return True
        except (WebDriverException, TimeoutException) as e:
            last_err = e
            err_msg = str(e)[:120]
            log_func(f"⚠️ Navigate lần {attempt}/{max_attempts} fail: {err_msg}")

            # Nếu session đã chết hẳn, không retry được — caller phải tạo driver mới
            if "invalid session id" in err_msg or "session deleted" in err_msg:
                raise

            if attempt < max_attempts:
                time.sleep(2)
    if last_err:
        raise last_err
    return False

def is_captcha_present(driver):
    """Kiểm tra captcha (Logic từ scraper.py)"""
    try:
        captcha_selectors = [
            '.captcha-verify-container',
            '#captcha-verify-container-main-page',
            '[class*="captcha"]',
            '.secsdk-captcha-drag-wrapper',
            'div[data-testid="captcha"]',
        ]
        for selector in captcha_selectors:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            for el in elements:
                if el.is_displayed(): return True
        return False
    except: return False

def wait_for_captcha(driver, log_func, stop_event):
    """Vòng lặp chờ giải Captcha (Logic từ scraper.py)"""
    if not is_captcha_present(driver): return

    log_func("🛑 PHÁT HIỆN CAPTCHA! Đang chờ bạn giải...")

    # Chờ tối đa 5 phút
    for i in range(300):
        if stop_event.is_set(): return
        if not is_captcha_present(driver):
            log_func("✅ Captcha đã được giải!")
            time.sleep(2)
            return
        time.sleep(1)
        if i % 10 == 0: log_func(f"    ... chờ captcha ({i}s)...")

def apply_cookies(driver, cookie_path, log_func):
    """Nạp cookie từ JSON (Logic từ scraper.py)"""
    try:
        with open(cookie_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        cookies = []
        if isinstance(data, dict) and 'cookies' in data:
            cookies = data['cookies']
        elif isinstance(data, list):
            cookies = data

        if not cookies: return False

        driver.get("https://www.tiktok.com")
        time.sleep(2)
        driver.delete_all_cookies()

        count = 0
        for cookie in cookies:
            try:
                selenium_cookie = {
                    'name': cookie.get('name'),
                    'value': cookie.get('value'),
                    'domain': cookie.get('domain', '.tiktok.com'),
                    'path': cookie.get('path', '/'),
                    'secure': cookie.get('secure', False)
                }
                driver.add_cookie(selenium_cookie)
                count += 1
            except: continue

        log_func(f"✅ Đã nạp {count} dòng cookie.")
        driver.refresh()
        time.sleep(3)
        return True
    except Exception as e:
        log_func(f"⚠️ Lỗi nạp cookie: {e}")
        return False

def click_comment_button(driver, log_func):
    """Tìm và click nút comment (Logic từ scraper.py)"""
    log_func("⏳ Đang tìm nút bình luận...")
    selectors = [
        "//div[@id='column-list-container']//button[contains(@aria-label, 'comment')]",
        "//span[@data-e2e='comment-icon']/ancestor::button",
        "//strong[@data-e2e='comment-count']/ancestor::button",
        "//span[contains(@class, 'xgplayer-icon-comment')]"
    ]

    wait = WebDriverWait(driver, 5)
    for xpath in selectors:
        try:
            button = wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
            if button:
                driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", button)
                time.sleep(0.5)
                driver.execute_script("arguments[0].click();", button)
                log_func("✅ Đã click mở bình luận.")
                return True
        except: continue

    log_func("ℹ️ Không click được (Có thể đã mở sẵn).")
    return False


def export_verified_session(driver, log_func, out_path, is_refresh=False):
    """
    Dump driver cookies (đặc biệt s_v_web_id, odin_tt, msToken) ra file out_path.
    Định dạng tương thích Playwright addCookies (expiry → expires, normalize sameSite).

    Args:
      driver: Selenium Chrome driver
      log_func: callback log lên GUI
      out_path: Path để ghi (caller cố định để 2 lần gọi ghi đè cùng 1 file)
      is_refresh: True ở lần gọi cuối → log message khác cho rõ
    """
    try:
        # Check browser còn alive trước khi gọi get_cookies (tránh ConnectionError stack-trace dài)
        try:
            _ = driver.current_url
        except Exception as conn_err:
            log_func(f"❌ Browser session đã đóng — không export được: {type(conn_err).__name__}")
            return None

        selenium_cookies = driver.get_cookies()
        if not selenium_cookies:
            log_func("⚠️ Không có cookie để export")
            return None

        out = []
        has_verify_token = False
        for c in selenium_cookies:
            same_site = c.get("sameSite") or "Lax"
            if isinstance(same_site, str):
                ss = same_site.strip().lower()
                if ss == "strict":
                    same_site = "Strict"
                elif ss in ("none", "no_restriction"):
                    same_site = "None"
                else:
                    same_site = "Lax"
            cookie_obj = {
                "name": c.get("name"),
                "value": c.get("value"),
                "domain": c.get("domain", ".tiktok.com"),
                "path": c.get("path", "/"),
                "secure": bool(c.get("secure", False)),
                "httpOnly": bool(c.get("httpOnly", False)),
                "sameSite": same_site,
            }
            if isinstance(c.get("expiry"), (int, float)) and c["expiry"] > 0:
                cookie_obj["expires"] = c["expiry"]
            out.append(cookie_obj)
            if c.get("name") == "s_v_web_id":
                has_verify_token = True

        if not has_verify_token and not is_refresh:
            log_func("⚠️ Cảnh báo: KHÔNG thấy `s_v_web_id` (token sau verify). Captcha có thể chưa qua đủ — file vẫn được xuất nhưng có thể không bypass captcha.")

        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)

        if is_refresh:
            log_func(f"🔄 Đã refresh msToken ({len(out)} cookies)")
            log_func(f"📁 File: {out_path}")
        else:
            log_func(f"💾 Đã xuất {len(out)} cookie verified-session → {out_path}")
            log_func("📤 Vào Settings → upload file này để bypass captcha cho các lần scrape sau.")
        return str(out_path)
    except Exception as e:
        log_func(f"❌ Lỗi export verified-session: {e}")
        return None


def tiktok_scroll_burst(driver, log_func, burst_count=15, interval_sec=0.06):
    """
    Kỹ thuật cuộn 'Burst' (Giật cục) từ scraper.py
    Giúp TikTok tải thêm comment mà không bị chặn.
    """
    try:
        before_height = driver.execute_script("return document.body.scrollHeight")

        # Cuộn nhanh nhiều lần nhỏ
        for _ in range(burst_count):
            driver.execute_script("window.scrollBy(0, 1200);")
            if interval_sec > 0: time.sleep(interval_sec)

        after_height = driver.execute_script("return document.body.scrollHeight")

        # Kiểm tra xem chiều cao trang có tăng lên không
        moved = after_height > before_height
        if moved:
            log_func(f"⚡ Burst Scroll: Đã tải thêm dữ liệu.")
        return moved
    except Exception as e:
        return False

# --- HÀM CHÍNH (MAIN ENTRY) ---

def run_cookie_forge(cookie_path, log_callback, stop_event):
    target_url = "https://www.tiktok.com/@ntdung6868/video/7517757443644869895"

    def log(msg):
        if log_callback: log_callback(msg)

    log("🚀 Khởi động CookieForge (Core: Scraper.py Logic)...")

    # Cố định path output cho cả run — early + final cùng ghi vào file này
    # (final ghi đè early, user chỉ thấy 1 file).
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    session_path = Path.home() / "Downloads" / f"tiktok-verified-session-{timestamp}.json"

    driver = None
    try:
        # 1. Init — retry 1 lần nếu Chrome crash ngay khi tạo session (Chrome 147 hay bị)
        for init_attempt in range(2):
            try:
                driver = setup_driver()
                break
            except WebDriverException as e:
                if init_attempt == 0:
                    log(f"⚠️ Lần 1 tạo driver fail ({str(e)[:80]}) — thử lại...")
                    time.sleep(2)
                else:
                    raise

        # 2. Cookies
        if cookie_path:
            log("🍪 Đang xử lý cookie...")
            apply_cookies(driver, cookie_path, log)

        # 3. Go to Video — dùng safe_navigate, retry nếu Chrome renderer chập chờn
        log("🌍 Truy cập video...")
        safe_navigate(driver, target_url, log)
        random_sleep(2.5, 4.0, stop_event)

        # 4. Interact
        click_comment_button(driver, log)
        wait_for_captcha(driver, log, stop_event)

        if stop_event.is_set(): return

        # 5a. EARLY EXPORT — chộp cookies NGAY sau khi captcha qua (hoặc không có).
        # Tránh trường hợp browser bị đóng/crash trong burst-scroll khiến mất hết.
        log("\n💾 Snapshot verified-session (sau captcha)...")
        export_path_early = export_verified_session(driver, log, session_path, is_refresh=False)

        # 5b. Trust Loop (Dùng thuật toán Burst Scroll của Scraper)
        log("\n⬇️  Bắt đầu Burst Scroll để nuôi Trust...")

        no_more_scroll = 0
        max_loops = 20 # Thực hiện khoảng 20 đợt cuộn

        for i in range(max_loops):
            if stop_event.is_set(): break

            # Check captcha định kỳ
            wait_for_captcha(driver, log, stop_event)

            # Thực hiện Burst Scroll
            has_more = tiktok_scroll_burst(driver, log)

            if not has_more:
                no_more_scroll += 1
                log(f"⏳ Không có nội dung mới, thử lại ({no_more_scroll}/3)...")

                # Logic Retry từ scraper.py: Cuộn lên rồi cuộn xuống
                if no_more_scroll < 3:
                    driver.execute_script("window.scrollBy(0, -500);")
                    time.sleep(0.5)
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(1.0)
            else:
                no_more_scroll = 0 # Reset nếu cuộn được

            if no_more_scroll >= 3:
                log("🛑 Đã cuộn hết trang.")
                break

            random_sleep(2.0, 4.0, stop_event)

        # 6. Final export — ghi đè cùng file với msToken mới rotate sau warm-up.
        # Nếu browser đã chết (user đóng cửa sổ) thì silently giữ snapshot sớm.
        log("\n🔄 Refresh msToken vào file verified-session...")
        try:
            final_path = export_verified_session(driver, log, session_path, is_refresh=True)
            if not final_path and export_path_early:
                log(f"ℹ️ Refresh thất bại — file sớm vẫn dùng được: {export_path_early}")
        except Exception as e:
            log(f"⚠️ Refresh lỗi (browser có thể đã đóng): {e}")
            if export_path_early:
                log(f"✅ Vẫn còn file: {export_path_early}")

        log("🎉 Quy trình hoàn tất! Cookie đã 'ấm'.")

    except Exception as e:
        log(f"❌ Lỗi vận hành: {e}")
    finally:
        log("👋 Đóng trình duyệt...")
        if driver: driver.quit()
