# ===========================================
# scraper.py - Logic Selenium Scraping
# ===========================================
# File này chứa các class để scrape comment từ TikTok và Facebook
# Sử dụng Selenium với Headless Chrome, Mobile View và auto-scroll
# UPDATED: Anti-detection improvements cho TikTok

import os
import re
import time
import json
import shutil
import random
import logging
import hashlib
import requests
from abc import ABC, abstractmethod
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, 
    NoSuchElementException,
    WebDriverException,
    StaleElementReferenceException
)
from webdriver_manager.chrome import ChromeDriverManager

# Cấu hình logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================
# ANTI-DETECTION: User Agents thực tế
# ============================================
REAL_USER_AGENTS = [
    # Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    # Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
]

# Mobile User Agents cho TikTok (ít bị detect hơn)
MOBILE_USER_AGENTS = [
    # iPhone
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    # Android
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
]

def get_random_user_agent(mobile=False):
    """Lấy ngẫu nhiên một User Agent thực tế"""
    agents = MOBILE_USER_AGENTS if mobile else REAL_USER_AGENTS
    return random.choice(agents)

def generate_device_id():
    """Sinh device ID ngẫu nhiên giống TikTok"""
    return ''.join(random.choices('0123456789', k=19))

def generate_browser_id():
    """Sinh browser ID ngẫu nhiên"""
    return hashlib.md5(str(random.random()).encode()).hexdigest()[:16]


class ScraperException(Exception):
    """Custom exception cho các lỗi scraping"""
    pass


class BotDetectedException(ScraperException):
    """Exception khi bị phát hiện là bot"""
    pass


class URLNotFoundException(ScraperException):
    """Exception khi URL không tồn tại"""
    pass


class CaptchaDetectedException(ScraperException):
    """Exception khi gặp Captcha"""
    pass


class BaseScraper(ABC):
    """
    Base class cho tất cả các scraper
    
    Định nghĩa interface chung và các phương thức dùng chung
    cho việc scrape comment từ các nền tảng khác nhau
    """
    
    def __init__(self, headless=True, proxy=None):
        """
        Khởi tạo scraper với cấu hình Chrome
        
        Args:
            headless: Chạy Chrome ở chế độ headless (không hiện cửa sổ)
            proxy: Proxy string (ví dụ: http://ip:port hoặc http://user:pass@ip:port)
        """
        self.headless = headless
        self.proxy = proxy
        self.driver = None
        # Tăng scroll_pause_time mặc định lên 2.5s để giảm captcha
        self.scroll_pause_time = float(os.getenv('SCROLL_PAUSE_TIME', 2.5))
        self.max_scroll_count = int(os.getenv('MAX_SCROLL_COUNT', 10))
        self.progress_callback = None  # Callback để cập nhật progress
    
    def _random_sleep(self, min_sec=2.0, max_sec=3.5):
        """
        Sleep với thời gian ngẫu nhiên để giống người dùng thật
        
        Args:
            min_sec: Thời gian tối thiểu (giây)
            max_sec: Thời gian tối đa (giây)
        """
        time.sleep(random.uniform(min_sec, max_sec))
    
    def _notify_progress(self, total, message=''):
        """Gọi callback để cập nhật progress nếu có"""
        if self.progress_callback:
            try:
                self.progress_callback(total, message)
            except:
                pass
        
    def _setup_driver(self, mobile_view=False, use_stealth=True):
        """
        Cấu hình và khởi tạo Chrome WebDriver với Anti-Detection
        
        Args:
            mobile_view: Sử dụng Mobile View cho TikTok
            use_stealth: Bật chế độ stealth để tránh bot detection
        
        Returns:
            webdriver.Chrome: Instance của Chrome WebDriver
        """
        chrome_options = Options()
        
        # ========== ANTI-DETECTION OPTIONS ==========
        # Tắt notifications và logging không cần thiết
        chrome_options.add_argument("--disable-notifications")
        chrome_options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # CRITICAL: Ẩn các dấu hiệu automation
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        
        # STEALTH: Thêm các preferences để giống browser thật
        if use_stealth:
            prefs = {
                'credentials_enable_service': False,
                'profile.password_manager_enabled': False,
                # Disable automation flags
                'excludeSwitches': ['enable-automation'],
                'useAutomationExtension': False,
                # Enable plugins để giống browser thật
                'plugins.always_open_pdf_externally': True,
                # WebRTC settings để ẩn IP thật
                'webrtc.ip_handling_policy': 'disable_non_proxied_udp',
                'webrtc.multiple_routes_enabled': False,
                'webrtc.nonproxied_udp_enabled': False,
            }
            chrome_options.add_experimental_option('prefs', prefs)
        
        if self.headless:
            # Chạy ở chế độ headless (không hiện cửa sổ)
            chrome_options.add_argument('--headless=new')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            
            # CRITICAL: Shared memory fix cho Docker
            chrome_options.add_argument('--shm-size=2g')
            chrome_options.add_argument('--disable-setuid-sandbox')
            
            # Additional options for Docker/Linux - CRITICAL for stability
            chrome_options.add_argument('--disable-software-rasterizer')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-background-networking')
            chrome_options.add_argument('--disable-background-timer-throttling')
            chrome_options.add_argument('--disable-backgrounding-occluded-windows')
            chrome_options.add_argument('--disable-breakpad')
            chrome_options.add_argument('--disable-component-extensions-with-background-pages')
            chrome_options.add_argument('--disable-component-update')
            chrome_options.add_argument('--disable-default-apps')
            chrome_options.add_argument('--disable-hang-monitor')
            chrome_options.add_argument('--disable-ipc-flooding-protection')
            chrome_options.add_argument('--disable-popup-blocking')
            chrome_options.add_argument('--disable-prompt-on-repost')
            chrome_options.add_argument('--disable-renderer-backgrounding')
            chrome_options.add_argument('--disable-sync')
            chrome_options.add_argument('--disable-translate')
            chrome_options.add_argument('--metrics-recording-only')
            chrome_options.add_argument('--no-first-run')
            chrome_options.add_argument('--safebrowsing-disable-auto-update')
            chrome_options.add_argument('--enable-features=NetworkService,NetworkServiceInProcess')
            chrome_options.add_argument('--force-color-profile=srgb')
            # Memory optimization - CRITICAL cho Railway
            chrome_options.add_argument('--memory-pressure-off')
            chrome_options.add_argument('--disable-features=TranslateUI,VizDisplayCompositor')
            chrome_options.add_argument('--disable-infobars')
            chrome_options.add_argument('--js-flags=--max-old-space-size=512')
            
            if mobile_view:
                # Dùng 375px (iPhone X) thay vì 320px - ít bị detect bot hơn
                chrome_options.add_argument('--window-size=375,812')
            else:
                chrome_options.add_argument('--window-size=1920,1080')
        
        # ========== ANTI-DETECTION: Random User-Agent ==========
        # Sử dụng User-Agent thực tế, random để tránh fingerprinting
        user_agent = get_random_user_agent(mobile=mobile_view)
        chrome_options.add_argument(f'user-agent={user_agent}')
        logger.info(f"🎭 Đang sử dụng User-Agent: {user_agent[:50]}...")
        
        # Cấu hình Proxy nếu có
        if self.proxy:
            proxy_str = self.proxy.strip()
            
            # Nếu proxy không có scheme, thêm http://
            if not proxy_str.startswith(('http://', 'https://', 'socks4://', 'socks5://')):
                proxy_str = f'http://{proxy_str}'
            
            # Kiểm tra nếu proxy có authentication (user:pass@ip:port)
            if '@' in proxy_str:
                # Proxy có authentication - cần extension
                # Format: http://user:pass@ip:port
                # Parse proxy
                from urllib.parse import urlparse
                parsed = urlparse(proxy_str)
                
                proxy_host = parsed.hostname
                proxy_port = parsed.port
                proxy_user = parsed.username
                proxy_pass = parsed.password
                
                if proxy_user and proxy_pass:
                    # Tạo extension cho proxy authentication
                    import zipfile
                    import tempfile
                    
                    manifest_json = '''{
                        "version": "1.0.0",
                        "manifest_version": 2,
                        "name": "Chrome Proxy",
                        "permissions": [
                            "proxy",
                            "tabs",
                            "unlimitedStorage",
                            "storage",
                            "<all_urls>",
                            "webRequest",
                            "webRequestBlocking"
                        ],
                        "background": {
                            "scripts": ["background.js"]
                        },
                        "minimum_chrome_version":"22.0.0"
                    }'''
                    
                    background_js = '''var config = {
                        mode: "fixed_servers",
                        rules: {
                            singleProxy: {
                                scheme: "http",
                                host: "%s",
                                port: parseInt(%s)
                            },
                            bypassList: ["localhost"]
                        }
                    };
                    chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});
                    function callbackFn(details) {
                        return {
                            authCredentials: {
                                username: "%s",
                                password: "%s"
                            }
                        };
                    }
                    chrome.webRequest.onAuthRequired.addListener(
                        callbackFn,
                        {urls: ["<all_urls>"]},
                        ['blocking']
                    );''' % (proxy_host, proxy_port, proxy_user, proxy_pass)
                    
                    # Tạo file extension tạm
                    plugin_file = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
                    with zipfile.ZipFile(plugin_file.name, 'w') as zp:
                        zp.writestr("manifest.json", manifest_json)
                        zp.writestr("background.js", background_js)
                    
                    chrome_options.add_extension(plugin_file.name)
                    logger.info(f"🌐 Đang sử dụng proxy (auth): {proxy_host}:{proxy_port}")
                else:
                    # Có @ nhưng không có user/pass hợp lệ
                    chrome_options.add_argument(f'--proxy-server={proxy_str}')
                    logger.info(f"🌐 Đang sử dụng proxy: {proxy_str}")
            else:
                # Proxy không có authentication - đơn giản
                chrome_options.add_argument(f'--proxy-server={proxy_str}')
                logger.info(f"🌐 Đang sử dụng proxy: {proxy_str}")
        
        # Detect Chrome/Chromium binary path
        chrome_bin = os.environ.get("CHROME_BIN")
        if chrome_bin and os.path.exists(chrome_bin):
            chrome_options.binary_location = chrome_bin
            logger.info(f"🔧 Sử dụng Chrome binary từ: {chrome_bin}")
        
        # Tìm ChromeDriver - ưu tiên chromedriver đã cài sẵn trong hệ thống
        driver_path = os.environ.get("CHROMEDRIVER_PATH")
        
        if driver_path:
            logger.info(f"🔧 Sử dụng ChromeDriver từ path: {driver_path}")
            service = Service(driver_path)
        else:
            # Kiểm tra chromedriver đã cài sẵn trong /usr/local/bin (từ Dockerfile)
            system_chromedriver = shutil.which("chromedriver")
            if system_chromedriver:
                logger.info(f"🔧 Sử dụng ChromeDriver từ hệ thống: {system_chromedriver}")
                service = Service(system_chromedriver)
            else:
                # Fallback: Dùng webdriver-manager để tự động tải
                logger.info("🔧 Đang tải ChromeDriver từ WebDriver Manager...")
                service = Service(ChromeDriverManager().install())
        
        logger.info("🚗 Đang khởi tạo Chrome WebDriver...")
        try:
            driver = webdriver.Chrome(service=service, options=chrome_options)
            logger.info("✅ Chrome WebDriver đã khởi tạo thành công!")
        except Exception as e:
            logger.error(f"❌ Lỗi khởi tạo Chrome WebDriver: {e}")
            raise
        
        # Thiết lập Mobile View cho TikTok (375px width - iPhone X)
        if mobile_view and not self.headless:
            try:
                driver.maximize_window()
                time.sleep(0.3)
                h = driver.get_window_size()["height"]
                # Dùng 375px (iPhone X) thay vì 320px - ít bị detect bot hơn
                driver.set_window_rect(x=0, y=0, width=375, height=h)
            except:
                pass
        
        # Thêm script để ẩn webdriver property
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            '''
        })
        
        # ========== COMPREHENSIVE STEALTH SCRIPTS ==========
        # Ẩn các dấu hiệu automation để vượt qua bot detection của TikTok
        if use_stealth:
            self._inject_stealth_scripts(driver)
        
        return driver
    
    def _inject_stealth_scripts(self, driver):
        """
        Inject các script stealth để ẩn dấu hiệu bot
        Dựa trên kỹ thuật của puppeteer-extra-stealth
        """
        stealth_scripts = [
            # 1. Ẩn navigator.webdriver hoàn toàn
            '''
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
            });
            delete navigator.__proto__.webdriver;
            ''',
            
            # 2. Fake plugins array (Chrome có nhiều plugins mặc định)
            '''
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
                    ];
                    plugins.length = 3;
                    return plugins;
                },
                configurable: true
            });
            ''',
            
            # 3. Fake languages
            '''
            Object.defineProperty(navigator, 'languages', {
                get: () => ['vi-VN', 'vi', 'en-US', 'en'],
                configurable: true
            });
            ''',
            
            # 4. Ẩn Chrome automation flags
            '''
            window.chrome = {
                runtime: {
                    PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
                    PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
                    PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
                    RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
                    OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
                    OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
                },
                loadTimes: function() { return {}; },
                csi: function() { return {}; },
                app: { isInstalled: false },
            };
            ''',
            
            # 5. Fake permissions API
            '''
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            ''',
            
            # 6. Ẩn headless mode indicators
            '''
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 4,
                configurable: true
            });
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8,
                configurable: true
            });
            ''',
            
            # 7. Fake WebGL vendor and renderer
            '''
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.call(this, parameter);
            };
            ''',
            
            # 8. Override toString để ẩn native code modifications
            '''
            const originalToString = Function.prototype.toString;
            Function.prototype.toString = function() {
                if (this === navigator.permissions.query) {
                    return 'function query() { [native code] }';
                }
                return originalToString.call(this);
            };
            ''',
        ]
        
        for script in stealth_scripts:
            try:
                driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                    'source': script
                })
            except Exception as e:
                logger.debug(f"Stealth script injection warning: {e}")
    
    def _human_like_mouse_move(self, element=None):
        """
        Di chuyển chuột ngẫu nhiên để giống người dùng thật
        Giúp bypass TikTok bot detection
        
        Args:
            element: Element để di chuyển đến (optional)
        """
        try:
            actions = ActionChains(self.driver)
            
            if element:
                # Di chuyển đến element với offset ngẫu nhiên
                offset_x = random.randint(-5, 5)
                offset_y = random.randint(-5, 5)
                actions.move_to_element_with_offset(element, offset_x, offset_y)
            else:
                # Di chuyển ngẫu nhiên trên trang
                viewport_width = self.driver.execute_script("return window.innerWidth")
                viewport_height = self.driver.execute_script("return window.innerHeight")
                
                # Di chuyển 2-4 điểm ngẫu nhiên
                for _ in range(random.randint(2, 4)):
                    x = random.randint(100, viewport_width - 100)
                    y = random.randint(100, viewport_height - 100)
                    actions.move_by_offset(x, y)
                    time.sleep(random.uniform(0.1, 0.3))
            
            actions.perform()
        except Exception as e:
            logger.debug(f"Mouse movement warning: {e}")
    
    def _human_like_scroll(self, scroll_amount=None):
        """
        Cuộn trang theo kiểu người dùng thật
        - Không cuộn đều đặn, có variation
        - Có pause ngẫu nhiên
        """
        try:
            if scroll_amount is None:
                scroll_amount = random.randint(300, 700)
            
            # Cuộn theo từng đoạn nhỏ với tốc độ khác nhau
            total_scrolled = 0
            while total_scrolled < scroll_amount:
                chunk = random.randint(50, 150)
                self.driver.execute_script(f"window.scrollBy(0, {chunk});")
                total_scrolled += chunk
                time.sleep(random.uniform(0.05, 0.15))
            
            # Đôi khi cuộn ngược lên một chút (giống người dùng thật)
            if random.random() < 0.2:
                self.driver.execute_script(f"window.scrollBy(0, -{random.randint(20, 50)});")
                
        except Exception as e:
            logger.debug(f"Human scroll warning: {e}")
    
    def _is_captcha_present(self):
        """
        Kiểm tra xem có Captcha trên trang không
        
        Returns:
            bool: True nếu có Captcha
        """
        try:
            captcha_selectors = [
                '.captcha-verify-container',
                '#captcha-verify-container-main-page',
                '[class*="captcha"]',
                '[id*="captcha"]',
                '.secsdk-captcha-drag-wrapper',  # TikTok captcha
                '[class*="Captcha"]',
                'div[data-testid="captcha"]',
            ]
            
            for selector in captcha_selectors:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                for el in elements:
                    if el.is_displayed():
                        return True
            return False
        except Exception as e:
            logger.debug(f"Lỗi scroll retry: {e}")
            return False
        except:
            return False
    
    def _wait_for_captcha_if_present(self, platform='unknown', max_wait_seconds=120):
        """
        Kiểm tra captcha và xử lý tùy theo chế độ headless
        
        - Headless BẬT: Dừng ngay, yêu cầu lấy cookie đã giải captcha
        - Headless TẮT: Chờ người dùng giải captcha thủ công trong cửa sổ Chrome
        
        Args:
            platform: Platform đang scrape ('tiktok' hoặc 'facebook')
            max_wait_seconds: Thời gian chờ tối đa khi non-headless (mặc định 120s)
        
        Raises:
            CaptchaDetectedException: Khi phát hiện captcha ở chế độ headless
        """
        if not self._is_captcha_present():
            return False
        
        # ========== CHẾ ĐỘ HEADLESS (BẬT) - DỪNG NGAY ==========
        if self.headless:
            logger.error("=" * 60)
            logger.error("🛑 PHÁT HIỆN CAPTCHA! DỪNG SCRAPING!")
            logger.error("=" * 60)

            if platform.lower() == 'tiktok':
                error_msg = """
🔒 CAPTCHA TIKTOK ĐƯỢC PHÁT HIỆN!

📋 HƯỚNG DẪN LẤY COOKIE ĐÃ GIẢI CAPTCHA:

1️⃣ Mở trình duyệt Chrome/Firefox (BẠN THƯỜNG DÙNG)
2️⃣ Truy cập https://www.tiktok.com
3️⃣ ĐĂNG NHẬP vào tài khoản TikTok của bạn
4️⃣ GIỮ TAB ĐÓ 10-15 PHÚT (quan trọng!)
5️⃣ Sau 10-15 phút quay lại tab tiktok, nếu có captcha hiện ra -> GIẢI CAPTCHA
6️⃣ Lấy cookie từ trình duyệt (xem hướng dẫn trong phần Cài đặt)
7️⃣ Thử scrape lại

💡 MẸO: Hoặc TẮT chế độ Headless trong Cài đặt để giải captcha thủ công!
"""
            else:  # Facebook
                error_msg = """
🔒 CAPTCHA FACEBOOK ĐƯỢC PHÁT HIỆN!

📋 HƯỚNG DẪN LẤY COOKIE ĐÃ GIẢI CAPTCHA:

1️⃣ Mở trình duyệt Chrome/Firefox (BẠN THƯỜNG DÙNG)
2️⃣ Truy cập https://www.facebook.com
3️⃣ ĐĂNG NHẬP vào tài khoản Facebook của bạn
4️⃣ Truy cập bài viết/video bạn muốn scrape
5️⃣ Nếu có captcha hiện ra -> GIẢI CAPTCHA
6️⃣ Lấy cookie từ trình duyệt
7️⃣ Thử scrape lại

💡 MẸO: Hoặc TẮT chế độ Headless trong Cài đặt để giải captcha thủ công!
"""

            logger.error(error_msg)
            raise CaptchaDetectedException(error_msg.strip())
        
        # ========== CHẾ ĐỘ NON-HEADLESS (TẮT) - CHỜ NGƯỜI DÙNG GIẢI ==========
        logger.warning("=" * 60)
        logger.warning("🛑 PHÁT HIỆN CAPTCHA! VUI LÒNG GIẢI TRONG CỬA SỔ CHROME")
        logger.warning("=" * 60)
        logger.info(f"⏳ Đang chờ bạn giải captcha... (tối đa {max_wait_seconds}s)")
        
        waited = 0
        while waited < max_wait_seconds:
            if not self._is_captcha_present():
                logger.info("✅ Captcha đã được giải! Tiếp tục scraping...")
                time.sleep(2)
                return False
            time.sleep(3)
            waited += 3
            if waited % 15 == 0:
                remaining = max_wait_seconds - waited
                logger.info(f"    ⏳ Vẫn đang chờ captcha ({waited}s / còn {remaining}s)...")
        
        # Hết thời gian chờ
        logger.error(f"❌ Hết thời gian chờ captcha ({max_wait_seconds}s)")
        raise CaptchaDetectedException(f"Captcha không được giải trong {max_wait_seconds}s. Vui lòng thử lại!")
    
    def _smart_scroll(self, max_retries=2):
        """
        Cuộn trang thông minh với retry mechanism
        
        Args:
            max_retries: Số lần thử lại khi không có data mới
            
        Returns:
            bool: True nếu còn data mới, False nếu đã hết
        """
        scroll_attempts = 0
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        
        while scroll_attempts < max_retries:
            # Cuộn xuống cuối trang
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            # Random sleep 2-3s để giống người dùng thật hơn
            time.sleep(random.uniform(2.0, 3.0))
            
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            
            if new_height == last_height:
                scroll_attempts += 1
                logger.info(f"⏳ Đang thử cuộn lại... ({scroll_attempts}/{max_retries})")
                
                # Scroll ngược lên 300px rồi xuống lại để kích hoạt event
                self.driver.execute_script("window.scrollBy(0, -300);")
                time.sleep(0.5)
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                # Chờ lâu hơn ở lần retry
                time.sleep(random.uniform(1.5, 2.5))
            else:
                last_height = new_height
                return True  # Còn data mới
        
        return False  # Đã hết data
    
    def _apply_cookies(self, cookie_data):
        """
        Áp dụng cookies vào driver với xử lý nâng cao
        
        QUAN TRỌNG cho TikTok:
        - Cần các cookie quan trọng: msToken, sessionid, tt_webid, tt_csrf_token
        - Cookie phải được lấy từ browser đã login và giải captcha
        
        Args:
            cookie_data: Dict hoặc List chứa cookies
            
        Returns:
            bool: True nếu thành công
        """
        if not cookie_data:
            return False
        
        try:
            # Lấy list cookies
            if isinstance(cookie_data, dict) and 'cookies' in cookie_data:
                cookies = cookie_data['cookies']
            elif isinstance(cookie_data, list):
                cookies = cookie_data
            else:
                return False
            
            # Xóa cookies cũ và thêm mới
            self.driver.delete_all_cookies()
            
            # Các cookie quan trọng cho TikTok (cần tracking)
            # Ưu tiên cao: msToken, sessionid, odin_tt
            # Ưu tiên trung: ttwid, s_v_web_id, tt_csrf_token
            # IDC cookies: tt-target-idc, store-idc (giúp bypass geo check)
            important_cookies = [
                'msToken',           # Token phiên - QUAN TRỌNG NHẤT
                'sessionid',         # Session ID - QUAN TRỌNG
                'odin_tt',           # Tracking token - QUAN TRỌNG
                'ttwid',             # Web ID
                's_v_web_id',        # Verify fingerprint
                'tt_csrf_token',     # CSRF token
                'passport_csrf_token',
                'tt-target-idc',     # IDC targeting
                'tt-target-idc-sign', # IDC signature
                'store-idc',         # Store IDC
                'store-country-code', # Country code
            ]
            found_important = []
            missing_critical = []
            
            # Critical cookies (nếu thiếu sẽ bị captcha cao)
            critical_cookies = ['msToken', 'sessionid', 'odin_tt']
            
            for cookie in cookies:
                try:
                    cookie_name = cookie.get('name', '')
                    
                    # Track các cookie quan trọng
                    if cookie_name in important_cookies:
                        found_important.append(cookie_name)
                    
                    selenium_cookie = {
                        'name': cookie_name,
                        'value': cookie.get('value'),
                        'domain': cookie.get('domain', '.tiktok.com'),
                        'path': cookie.get('path', '/'),
                        'secure': cookie.get('secure', False)
                    }
                    self.driver.add_cookie(selenium_cookie)
                except Exception as e:
                    logger.warning(f"Không thể add cookie: {e}")
                    continue
            
            logger.info(f"✅ Đã apply {len(cookies)} cookies")
            
            # Log các cookie quan trọng đã tìm thấy
            if found_important:
                logger.info(f"🔑 Cookie quan trọng đã có: {', '.join(found_important)}")
            
            # Kiểm tra critical cookies
            for cc in critical_cookies:
                if cc not in found_important:
                    missing_critical.append(cc)
            
            if missing_critical:
                logger.warning(f"⚠️ THIẾU cookie quan trọng: {', '.join(missing_critical)}")
                if 'odin_tt' in missing_critical:
                    logger.warning("💡 Thiếu odin_tt - Khuyên dùng J2TEAM Cookies extension để export!")
                if 'msToken' in missing_critical:
                    logger.warning("💡 Thiếu msToken - Cookie chưa được lấy đúng cách!")
            else:
                logger.info("✅ Đã có đủ các cookie quan trọng!")
            
            return True
            
        except Exception as e:
            logger.warning(f"Lỗi apply cookies: {e}")
            return False
    
    def _extract_tokens_from_page(self):
        """
        Trích xuất các token động từ trang sau khi load
        TikTok cần các token này để validate request
        
        Returns:
            dict: Các token tìm được (msToken, verifyFp, etc.)
        """
        tokens = {}
        try:
            # Lấy msToken từ cookie
            cookies = self.driver.get_cookies()
            for cookie in cookies:
                if cookie['name'] == 'msToken':
                    tokens['msToken'] = cookie['value']
                elif cookie['name'] == 'tt_csrf_token':
                    tokens['tt_csrf_token'] = cookie['value']
                elif cookie['name'] == 's_v_web_id':
                    tokens['verifyFp'] = cookie['value']
            
            # Cố gắng lấy thêm từ JavaScript
            try:
                # TikTok thường lưu token trong window object
                js_tokens = self.driver.execute_script('''
                    let tokens = {};
                    if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props) {
                        tokens.pageProps = window.__NEXT_DATA__.props.pageProps;
                    }
                    if (typeof window.SIGI_STATE !== 'undefined') {
                        tokens.sigiState = true;
                    }
                    return JSON.stringify(tokens);
                ''')
                logger.debug(f"JS tokens found: {js_tokens[:100]}...")
            except:
                pass
            
            if tokens:
                logger.info(f"🔑 Đã trích xuất tokens: {list(tokens.keys())}")
            
        except Exception as e:
            logger.debug(f"Token extraction warning: {e}")
        
        return tokens
    
    @abstractmethod
    def scrape(self, url, cookie_data=None):
        """
        Phương thức scrape chính - cần được implement bởi subclass
        
        Args:
            url: URL của video/post cần scrape
            cookie_data: Dict/List chứa cookies (optional)
            
        Returns:
            list: Danh sách các comment đã scrape được
        """
        pass
    
    def close(self):
        """Đóng browser sau khi scrape xong"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None


# ============================================
# TikTok API Scraper - Giống ExportComments
# ============================================
class TikTokAPIScraper:
    """
    Scraper TikTok sử dụng API trực tiếp thay vì Selenium
    
    Đây là phương pháp giống ExportComments.com sử dụng:
    - Dùng cookie từ browser đã đăng nhập của user
    - Gọi trực tiếp TikTok Comment API
    - Không cần render page → không bị captcha
    
    API Endpoint: https://www.tiktok.com/api/comment/list/
    """
    
    COMMENT_API = "https://www.tiktok.com/api/comment/list/"
    VIDEO_DETAIL_API = "https://www.tiktok.com/api/item/detail/"
    
    def __init__(self):
        self.session = requests.Session()
        self.cookies = {}
        self.headers = {}
        
    def _setup_session(self, cookie_data):
        """
        Setup session với cookies từ user
        
        Args:
            cookie_data: Cookies dạng JSON string, dict, hoặc list
        """
        # Parse cookies
        if isinstance(cookie_data, str):
            try:
                cookie_data = json.loads(cookie_data)
            except:
                logger.error("Invalid cookie JSON")
                return False
        
        # Convert cookies to dict for requests
        if isinstance(cookie_data, list):
            for cookie in cookie_data:
                name = cookie.get('name', '')
                value = cookie.get('value', '')
                if name and value:
                    self.cookies[name] = value
        elif isinstance(cookie_data, dict):
            # Check if it's wrapped format {'url': ..., 'cookies': [...]}
            if 'cookies' in cookie_data and isinstance(cookie_data['cookies'], list):
                for cookie in cookie_data['cookies']:
                    name = cookie.get('name', '')
                    value = cookie.get('value', '')
                    if name and value:
                        self.cookies[name] = value
            # Nếu là single cookie {name: ..., value: ...}
            elif 'name' in cookie_data and 'value' in cookie_data:
                self.cookies[cookie_data['name']] = cookie_data['value']
            else:
                # Nếu đã là dict {cookie_name: cookie_value}
                self.cookies = cookie_data
        
        # Check required cookies
        required = ['sessionid', 'msToken']
        found = [c for c in required if c in self.cookies]
        
        if len(found) < 1:
            logger.warning(f"⚠️ Missing important cookies. Found: {list(self.cookies.keys())[:10]}")
        
        # Setup headers giống browser thật
        self.headers = {
            'User-Agent': get_random_user_agent(mobile=False),
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.tiktok.com/',
            'Origin': 'https://www.tiktok.com',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
        }
        
        # Add cookies to session
        for name, value in self.cookies.items():
            self.session.cookies.set(name, value, domain='.tiktok.com')
        
        logger.info(f"🍪 Loaded {len(self.cookies)} cookies for API scraping")
        return True
    
    def _extract_video_id(self, url):
        """
        Extract video ID từ URL TikTok
        
        Supports:
        - https://www.tiktok.com/@user/video/7123456789
        - https://vm.tiktok.com/XXXXX/
        """
        # Pattern cho URL đầy đủ
        match = re.search(r'/video/(\d+)', url)
        if match:
            return match.group(1)
        
        # Nếu là short URL, cần follow redirect
        if 'vm.tiktok.com' in url or 'vt.tiktok.com' in url:
            try:
                resp = requests.head(url, allow_redirects=True, timeout=10)
                match = re.search(r'/video/(\d+)', resp.url)
                if match:
                    return match.group(1)
            except:
                pass
        
        return None
    
    def _extract_username_from_url(self, url):
        """Extract @username từ URL"""
        match = re.search(r'@([^/\?]+)', url)
        return f"@{match.group(1)}" if match else "Unknown"
    
    def get_comments(self, video_id, count=100, cursor=0):
        """
        Lấy comments từ TikTok API
        
        Args:
            video_id: ID của video
            count: Số lượng comment cần lấy (max ~50 per request)
            cursor: Offset để pagination
            
        Returns:
            dict: Response từ API
        """
        import time
        import random
        
        # Generate device_id if not exists
        device_id = self.cookies.get('tt_chain_token', str(random.randint(1000000000000000000, 9999999999999999999)))
        
        params = {
            'aweme_id': video_id,
            'count': min(count, 50),  # TikTok limit 50 per request
            'cursor': cursor,
            'aid': '1988',  # TikTok Web app ID
            'app_language': 'en',
            'app_name': 'tiktok_web',
            'browser_language': 'en-US',
            'browser_name': 'Mozilla',
            'browser_online': 'true',
            'browser_platform': 'MacIntel',
            'browser_version': '5.0 (Macintosh)',
            'channel': 'tiktok_web',
            'cookie_enabled': 'true',
            'current_region': 'VN',
            'device_id': device_id,
            'device_platform': 'web_pc',
            'enter_from': 'tiktok_web',
            'focus_state': 'true',
            'from_page': 'video',
            'history_len': '3',
            'is_fullscreen': 'false',
            'is_page_visible': 'true',
            'os': 'mac',
            'priority_region': '',
            'referer': '',
            'region': 'VN',
            'screen_height': '1080',
            'screen_width': '1920',
            'webcast_language': 'en',
        }
        
        # Add msToken nếu có (quan trọng!)
        if 'msToken' in self.cookies:
            params['msToken'] = self.cookies['msToken']
        
        try:
            response = self.session.get(
                self.COMMENT_API,
                params=params,
                headers=self.headers,
                timeout=30
            )
            
            logger.debug(f"API Response status: {response.status_code}, length: {len(response.text)}")
            
            if response.status_code == 200:
                # Check if response is empty
                if not response.text or len(response.text) < 10:
                    logger.error(f"Empty response from API")
                    return None
                
                # Check if response is HTML (captcha/error page)
                if response.text.strip().startswith('<!') or response.text.strip().startswith('<html'):
                    logger.error(f"TikTok returned HTML instead of JSON (possibly captcha)")
                    logger.debug(f"HTML preview: {response.text[:500]}")
                    return None
                
                try:
                    return response.json()
                except Exception as json_err:
                    logger.error(f"JSON parse error: {json_err}")
                    logger.error(f"Response preview: {response.text[:300]}")
                    return None
            else:
                logger.error(f"API error: {response.status_code} - {response.text[:200]}")
                return None
                
        except Exception as e:
            logger.error(f"Request error: {e}")
            return None
    
    def scrape(self, url, cookie_data=None, max_comments=500):
        """
        Scrape comments từ video TikTok sử dụng API
        
        Args:
            url: URL video TikTok
            cookie_data: Cookies từ extension/user
            max_comments: Số comment tối đa cần lấy
            
        Returns:
            list: Danh sách comments [{username, text, likes}, ...]
        """
        logger.info(f"🚀 [API Mode] Bắt đầu scrape: {url}")
        
        if not cookie_data:
            logger.error("❌ Cần cookies để sử dụng API mode!")
            raise ScraperException("Cookies required for API scraping. Please provide TikTok cookies.")
        
        # Setup session với cookies
        if not self._setup_session(cookie_data):
            raise ScraperException("Failed to setup session with cookies")
        
        # Extract video ID
        video_id = self._extract_video_id(url)
        if not video_id:
            raise ScraperException(f"Could not extract video ID from URL: {url}")
        
        logger.info(f"📹 Video ID: {video_id}")
        
        # Scrape comments với pagination
        all_comments = []
        cursor = 0
        username_from_url = self._extract_username_from_url(url)
        
        while len(all_comments) < max_comments:
            logger.info(f"📥 Fetching comments... (cursor: {cursor}, got: {len(all_comments)})")
            
            data = self.get_comments(video_id, count=50, cursor=cursor)
            
            if not data:
                logger.warning("⚠️ API returned no data")
                break
            
            # Log raw response for debugging
            logger.debug(f"API Response keys: {list(data.keys())}")
            
            # Check for errors
            status_code = data.get('status_code')
            if status_code != 0:
                status_msg = data.get('status_msg', '')
                extra_info = data.get('extra', {})
                logger.error(f"❌ API error: status_code={status_code}, msg='{status_msg}', extra={extra_info}")
                
                # Check if it's a captcha or rate limit
                if status_msg and ('captcha' in status_msg.lower() or 'verify' in status_msg.lower()):
                    raise CaptchaDetectedException("TikTok requires captcha verification")
                
                # If status_code is not 0 and no comments, might need different approach
                if status_code == 10201:
                    logger.error("❌ Video not found or deleted")
                elif status_code == 10204:
                    logger.error("❌ Comments are disabled for this video")
                
                break
            
            comments_data = data.get('comments', [])
            
            if not comments_data:
                logger.info("✅ Đã lấy hết comments")
                break
            
            # Parse comments
            for comment in comments_data:
                try:
                    user = comment.get('user', {})
                    comment_info = {
                        'username': f"@{user.get('unique_id', user.get('nickname', 'unknown'))}",
                        'text': comment.get('text', ''),
                        'likes': comment.get('digg_count', 0),
                        'reply_count': comment.get('reply_comment_total', 0),
                        'create_time': comment.get('create_time', 0),
                        'cid': comment.get('cid', ''),
                    }
                    all_comments.append(comment_info)
                except Exception as e:
                    logger.debug(f"Error parsing comment: {e}")
                    continue
            
            # Check if more comments available
            has_more = data.get('has_more', 0)
            if not has_more:
                logger.info("✅ Đã lấy hết comments")
                break
            
            # Update cursor for next page
            cursor = data.get('cursor', cursor + 50)
            
            # Random delay để tránh rate limit
            time.sleep(random.uniform(0.5, 1.5))
        
        logger.info(f"🎉 [API Mode] Đã scrape được {len(all_comments)} comments!")
        
        return all_comments
    
    def close(self):
        """Close session"""
        self.session.close()


class TikTokScraper(BaseScraper):
    """
    Scraper cho TikTok
    
    Sử dụng Mobile View (320px) để:
    - Giao diện đơn giản hơn, dễ scrape
    - Ít bị bot detection hơn
    - Comment hiển thị trong panel riêng
    """
    
    def _extract_userid_from_url(self, url):
        """
        Trích xuất User ID từ URL profile
        
        Args:
            url: URL chứa @username
            
        Returns:
            str: User ID (vd: @username)
        """
        try:
            if "@" in url:
                part = url.split("@")[1]
                return f"@{part.split('?')[0].split('/')[0]}"
        except:
            pass
        return "Unknown"
    
    def _is_timestamp_text(self, text):
        """
        Kiểm tra text có phải là timestamp không
        
        Args:
            text: Text cần kiểm tra
            
        Returns:
            bool: True nếu là timestamp
        """
        if not text or len(text) > 30:
            return False
        
        text_stripped = text.strip()
        text_lower = text_stripped.lower()
        
        # Check format ngày TikTok: M-DD hoặc MM-DD (tháng-ngày)
        # VD: 1-13 (13 tháng 1), 12-25 (25 tháng 12), 10-28
        if re.match(r'^\d{1,2}-\d{1,2}$', text_stripped):
            parts = text_stripped.split('-')
            month = int(parts[0])
            day = int(parts[1])
            # Validate: tháng 1-12, ngày 1-31
            if 1 <= month <= 12 and 1 <= day <= 31:
                return True
        
        # Check format ngày đầy đủ YYYY-MM-DD hoặc DD-MM-YYYY hoặc DD/MM/YYYY
        date_patterns = [
            r'^\d{4}-\d{1,2}-\d{1,2}$',       # 2025-10-28, 2025-1-5
            r'^\d{1,2}-\d{1,2}-\d{4}$',       # 28-10-2025
            r'^\d{1,2}/\d{1,2}/\d{4}$',       # 28/10/2025
            r'^\d{4}/\d{1,2}/\d{1,2}$',       # 2025/10/28
            r'^\d{1,2}-\d{1,2}-\d{2}$',       # 28-10-25
            r'^\d{1,2}/\d{1,2}/\d{2}$',       # 28/10/25
            r'^\d{1,2}/\d{1,2}$',             # 10/28, 1/13 (MM/DD)
        ]
        
        for pattern in date_patterns:
            if re.match(pattern, text_stripped):
                return True
        
        # Patterns cho timestamp TikTok dạng relative
        time_patterns = [
            # English
            'd ago', 'h ago', 'm ago', 's ago', 'w ago',
            'day', 'hour', 'minute', 'second', 'week', 'month', 'year',
            'just now', 'yesterday',
            # Viết tắt có số đi kèm
            '1d', '2d', '3d', '4d', '5d', '6d', '7d',
            '1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '11h', '12h',
            '1m', '2m', '3m', '5m', '10m', '15m', '20m', '30m', '45m',
            '1w', '2w', '3w', '4w',
            # Vietnamese
            'giờ', 'phút', 'giây', 'ngày', 'tuần', 'tháng', 'năm',
            'vừa xong', 'hôm qua', 'hôm nay'
        ]
        
        for pattern in time_patterns:
            if pattern in text_lower:
                return True
        
        # Check nếu text chỉ chứa số + chữ cái ngắn (như "2d", "5h", "10m", "15d")
        if re.match(r'^\d{1,3}[dhmswy]$', text_lower):
            return True
        
        # Check format "X days ago", "X giờ trước"
        if re.match(r'^\d+\s*(d|h|m|s|w|days?|hours?|minutes?|seconds?|weeks?|months?|years?)', text_lower):
            return True
        
        return False
    
    def _parse_count(self, text):
        """
        Chuyển đổi số có đơn vị K, M thành số nguyên
        
        Args:
            text: Chuỗi số (vd: "1.2K", "5M", "123")
            
        Returns:
            int: Giá trị số nguyên
        """
        try:
            text = text.upper().strip()
            if 'K' in text:
                return int(float(text.replace('K', '')) * 1000)
            elif 'M' in text:
                return int(float(text.replace('M', '')) * 1000000)
            else:
                # Loại bỏ các ký tự không phải số
                num = re.sub(r'[^\d]', '', text)
                return int(num) if num else 0
        except:
            return 0

    def _tiktok_scroll_burst(self, burst_count=15, interval_sec=0.06):
        """Cuộn nhanh liên tục cho TikTok, trả về True nếu còn load thêm."""
        try:
            before_top = self.driver.execute_script(
                "return window.pageYOffset || document.documentElement.scrollTop || 0;"
            )
            before_height = self.driver.execute_script("return document.body.scrollHeight")

            for _ in range(burst_count):
                self.driver.execute_script("window.scrollBy(0, 1200);")
                if interval_sec > 0:
                    time.sleep(interval_sec)

            after_top = self.driver.execute_script(
                "return window.pageYOffset || document.documentElement.scrollTop || 0;"
            )
            after_height = self.driver.execute_script("return document.body.scrollHeight")

            moved = (after_top > before_top) or (after_height > before_height)
            logger.info(
                f"⚡ TikTok burst: moved={moved} (top {before_top} -> {after_top}; h {before_height} -> {after_height})"
            )
            return moved
        except Exception as e:
            logger.debug(f"TikTok burst scroll error: {e}")
            return False
    
    def _click_comment_button(self):
        """
        Click vào nút bình luận để mở panel comment (nếu cần)
        Với TikTok photo/video mới, comment thường đã hiển thị sẵn.
        
        Returns:
            bool: True nếu click thành công hoặc không cần click
        """
        logger.info("⏳ Đang tìm nút bình luận...")
        
        # Các selector có thể cho nút comment
        selectors = [
            "//div[@id='column-list-container']//button[contains(@aria-label, 'comment')]",
            "//span[@data-e2e='comment-icon']/ancestor::button",
            "//strong[@data-e2e='comment-count']/ancestor::button",
            "//span[contains(@class, 'xgplayer-icon-comment')]"
        ]
        
        try:
            # Cách 1: Tìm nhanh bằng find_elements (không chờ)
            for xpath in selectors:
                try:
                    buttons = self.driver.find_elements(By.XPATH, xpath)
                    for btn in buttons:
                        if btn.is_displayed():
                            self.driver.execute_script(
                                "arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", 
                                btn
                            )
                            time.sleep(0.5)
                            self.driver.execute_script("arguments[0].click();", btn)
                            logger.info("✅ Đã click mở bình luận.")
                            return True
                except:
                    continue
            
            # Cách 2: Chờ ngắn với WebDriverWait (chỉ 3 giây mỗi selector)
            wait = WebDriverWait(self.driver, 3)
            for xpath in selectors:
                try:
                    button = wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
                    if button:
                        self.driver.execute_script(
                            "arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", 
                            button
                        )
                        time.sleep(0.5)
                        self.driver.execute_script("arguments[0].click();", button)
                        logger.info("✅ Đã click mở bình luận.")
                        return True
                except:
                    continue
            
            # Không tìm thấy nút - có thể comment đã hiển thị sẵn (TikTok photo/video mới)
            logger.info("ℹ️ Không cần click nút bình luận (đã hiển thị sẵn).")
            return True  # Return True để tiếp tục scrape
                
        except Exception as e:
            logger.warning(f"⚠️ Lỗi tìm nút comment: {e}")
            return True  # Vẫn return True để tiếp tục scrape
    
    def scrape(self, url, cookie_data=None):
        """
        Scrape comment từ video TikTok
        
        Quy trình:
        1. Mở trang với Mobile View
        2. Apply cookies nếu có
        3. Click nút comment để mở panel
        4. Scroll và thu thập comment
        5. Loại bỏ duplicate bằng set
        
        Args:
            url: URL video TikTok
            cookie_data: Dict/List chứa cookies (optional)
            
        Returns:
            list: Danh sách dictionary chứa thông tin comment
        """
        comments = []
        data_set = set()  # Để loại bỏ duplicate
        
        try:
            logger.info(f"🚀 Bắt đầu scrape TikTok: {url}")
            logger.info("🎭 Sử dụng Anti-Detection Mode...")
            
            # Khởi tạo driver với stealth mode
            self.driver = self._setup_driver(mobile_view=False, use_stealth=True)

            # Set window size 420px giống Facebook để ổn định UI
            try:
                self.driver.maximize_window()
                time.sleep(0.3)
                h = self.driver.get_window_size()["height"]
                self.driver.set_window_rect(x=0, y=0, width=420, height=h)
            except:
                pass
            
            # Nếu có cookie, truy cập tiktok.com trước để apply
            if cookie_data:
                logger.info("🍪 Đang apply cookies...")
                self.driver.get("https://www.tiktok.com")
                self._random_sleep(2.0, 3.0)  # Random sleep để giống người dùng thật
                
                # Di chuyển chuột ngẫu nhiên để giống người dùng thật
                self._human_like_mouse_move()
                
                if self._apply_cookies(cookie_data):
                    logger.info("✅ Đã apply cookies thành công")
                    # Refresh để áp dụng cookies
                    self.driver.refresh()
                    self._random_sleep(2.0, 3.0)
                else:
                    logger.warning("⚠️ Không thể apply cookies")
            
            # Truy cập URL video
            logger.info("🌍 Đang truy cập trang...")
            self.driver.get(url)
            self._random_sleep(3.0, 5.0)  # Chờ lâu hơn để trang load
            
            # Di chuyển chuột ngẫu nhiên (hành vi người dùng thật)
            self._human_like_mouse_move()
            
            # Trích xuất tokens từ trang (để debug)
            tokens = self._extract_tokens_from_page()
            
            # Log thông tin debug
            try:
                page_title = self.driver.title
                logger.info(f"📄 Page title: {page_title}")
                logger.info(f"📍 Current URL: {self.driver.current_url}")
            except:
                pass
            
            # Click nút comment để mở panel
            self._click_comment_button()
            self._random_sleep(1.5, 2.5)  # Random sleep
            # Chờ thêm để comment load ổn định
            time.sleep(1.2)
            
            # Kiểm tra captcha
            # Nếu có cookies, thử tiếp tục vì captcha có thể là false positive
            if self._is_captcha_present():
                if cookie_data:
                    logger.warning("⚠️ Phát hiện captcha nhưng có cookies - thử tiếp tục...")
                    # Chờ thêm để xem captcha có tự biến mất không
                    time.sleep(3)
                    # Kiểm tra lại - nếu vẫn có captcha thì báo lỗi
                    if self._is_captcha_present():
                        logger.warning("⚠️ Captcha vẫn còn sau 3s, thử refresh...")
                        self.driver.refresh()
                        self._random_sleep(3.0, 5.0)
                        self._click_comment_button()
                        self._random_sleep(1.5, 2.5)
                        
                        # Check captcha lần cuối
                        if self._is_captcha_present():
                            self._wait_for_captcha_if_present(platform='tiktok')
                else:
                    self._wait_for_captcha_if_present(platform='tiktok')
            
            logger.info("   📜 Đang cuộn liên tục đến cuối...")
            no_more_scroll = 0
            scroll_count = 0
            while True:
                # Kiểm tra captcha định kỳ
                if self._is_captcha_present():
                    self._wait_for_captcha_if_present(platform='tiktok')
                
                # Thỉnh thoảng di chuyển chuột để giống người dùng thật
                scroll_count += 1
                if scroll_count % 5 == 0:
                    self._human_like_mouse_move()

                has_more = self._tiktok_scroll_burst(burst_count=15, interval_sec=0.06)
                if not has_more:
                    no_more_scroll += 1
                    logger.info(f"⏳ Không có data mới, retry {no_more_scroll}/3...")
                    # Thử scroll ngược lên rồi xuống để kích hoạt load
                    if no_more_scroll < 3:
                        self.driver.execute_script("window.scrollBy(0, -500);")
                        time.sleep(0.5)
                        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                        time.sleep(1.0)
                else:
                    no_more_scroll = 0

                if no_more_scroll >= 3:
                    logger.info("🛑 Đã retry 2 lần, cuộn tới cuối, bắt đầu quét comment...")
                    break

            # ===== QUÉT COMMENT SAU KHI CUỘN XONG =====
            try:
                comment_elements = self.driver.find_elements(
                    By.CSS_SELECTOR,
                    '[data-e2e="comment-level-1"]'
                )
            except:
                comment_elements = []

            count_new = 0
            for element in comment_elements:
                try:
                    comment_text = element.text.strip()
                    if not comment_text:
                        continue

                    # Lấy parent container của comment để tìm các thông tin khác
                    try:
                        comment_container = element.find_element(
                            By.XPATH,
                            "./ancestor::div[contains(@class, 'CommentItem') or contains(@class, 'comment-item')][1]"
                        )
                    except:
                        try:
                            comment_container = element.find_element(By.XPATH, "./ancestor::div[3]")
                        except:
                            comment_container = None

                    # Tìm User ID
                    user_id = "Unknown"
                    try:
                        user_link_el = element.find_element(
                            By.XPATH,
                            "./ancestor::div[1]//a[contains(@href, '@')][1]"
                        )
                        user_link = user_link_el.get_attribute('href')
                        user_id = self._extract_userid_from_url(user_link)
                    except:
                        try:
                            user_link_el = element.find_element(
                                By.XPATH,
                                "./preceding::a[contains(@href, '@')][1]"
                            )
                            user_link = user_link_el.get_attribute('href')
                            user_id = self._extract_userid_from_url(user_link)
                        except:
                            pass

                    # Timestamp - bỏ qua để tăng tốc
                    timestamp = "N/A"

                    # Tìm Likes count - Nằm trong DivLikeContainer
                    likes = 0

                    likes_search_contexts = []
                    try:
                        likes_search_contexts.append(element.find_element(By.XPATH, "./.."))
                    except:
                        pass
                    try:
                        likes_search_contexts.append(element.find_element(By.XPATH, "./../.."))
                    except:
                        pass
                    if comment_container:
                        likes_search_contexts.append(comment_container)

                    for search_ctx in likes_search_contexts:
                        if likes > 0:
                            break

                        try:
                            like_container = search_ctx.find_element(
                                By.XPATH,
                                ".//div[contains(@aria-label, 'like') or contains(@class, 'LikeContainer')]"
                            )
                            if like_container:
                                aria_label = like_container.get_attribute('aria-label')
                                if aria_label and 'like' in aria_label.lower():
                                    match = re.search(r'(\d+)\s*like', aria_label.lower())
                                    if match:
                                        likes = int(match.group(1))
                                        continue

                                like_span = like_container.find_element(By.CSS_SELECTOR, "span.TUXText")
                                if like_span:
                                    likes_text = like_span.text.strip()
                                    if likes_text and likes_text.isdigit():
                                        likes = int(likes_text)
                                    elif likes_text:
                                        likes = self._parse_count(likes_text)
                        except:
                            pass

                        if likes == 0:
                            likes_selectors = [
                                "[data-e2e='comment-like-count']",
                                "div[class*='LikeContainer'] span",
                                "span[class*='LikeCount']"
                            ]
                            for selector in likes_selectors:
                                try:
                                    likes_el = search_ctx.find_element(By.CSS_SELECTOR, selector)
                                    if likes_el:
                                        likes_text = likes_el.text.strip()
                                        if likes_text and likes_text.isdigit():
                                            likes = int(likes_text)
                                            break
                                        elif likes_text:
                                            likes = self._parse_count(likes_text)
                                            if likes > 0:
                                                break
                                except:
                                    continue

                    unique_key = (user_id, comment_text)
                    if unique_key not in data_set:
                        data_set.add(unique_key)
                        comments.append({
                            'username': user_id,
                            'content': comment_text,
                            'timestamp': timestamp,
                            'likes': likes
                        })
                        count_new += 1

                        short_text = comment_text[:40].replace('\n', ' ')
                        logger.info(f"   + {user_id}: {short_text}...")

                except StaleElementReferenceException:
                    continue
                except Exception:
                    continue

            if count_new > 0:
                logger.info(f"✅ Lấy thêm {count_new} (Tổng: {len(comments)})")
                self._notify_progress(len(comments), f'Đã cào {len(comments)} bình luận')
            
            logger.info(f"\n🎉 Đã scrape được {len(comments)} comment")
            return comments
            
        except (BotDetectedException, URLNotFoundException, CaptchaDetectedException):
            raise
        except WebDriverException as e:
            raise ScraperException(f"Lỗi WebDriver: {str(e)}")
        except Exception as e:
            raise ScraperException(f"Lỗi không xác định: {str(e)}")
        finally:
            self.close()


class FacebookScraper(BaseScraper):
    """
    Scraper cho Facebook
    
    Lấy comment từ video/post Facebook công khai
    Sử dụng kỹ thuật từ code tham khảo: chuyển bộ lọc, scroll dialog
    """
    
    def _parse_count(self, text):
        """
        Chuyển đổi số có đơn vị K, M thành số nguyên
        
        Args:
            text: Chuỗi số (vd: "1.2K", "5M", "123")
            
        Returns:
            int: Giá trị số nguyên
        """
        try:
            text = text.upper().strip()
            if 'K' in text:
                return int(float(text.replace('K', '')) * 1000)
            elif 'M' in text:
                return int(float(text.replace('M', '')) * 1000000)
            else:
                # Loại bỏ các ký tự không phải số
                num = re.sub(r'[^\d]', '', text)
                return int(num) if num else 0
        except:
            return 0
    
    def _is_junk_line(self, text):
        """
        Kiểm tra dòng text có phải là rác không (Thích, Trả lời, timestamp...)
        Theo code tham khảo - đơn giản hóa
        """
        t = text.strip().lower()
        
        junk_phrases = [
            "thích", "trả lời", "phản hồi", "chia sẻ", "xem thêm", 
            "viết bình luận", "bình luận", "like", "reply", "share", 
            "phù hợp nhất", "tất cả bình luận", "xem bản dịch", 
            "theo dõi", "follow", "đang theo dõi", "đã chỉnh sửa", 
            "tác giả", "top fan"
        ]
        if t in junk_phrases:
            return True
        
        # Patterns thời gian
        time_patterns = [
            r"^\d+\s?(giờ|phút|giây|ngày|tuần|năm|h|m|d|y|w)$",
            r"^vừa xong$", r"^just now$", r"^\d+$"
        ]
        for p in time_patterns:
            if re.match(p, t):
                return True
        return False
    
    def _extract_fb_user_id(self, url):
        """
        Trích xuất User ID từ URL Facebook
        VD: https://www.facebook.com/luong.tuantai.0987748389?comment_id=xxx
        -> luong.tuantai.0987748389
        """
        if not url:
            return "Unknown"
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(url)
            path = parsed.path
            query = parse_qs(parsed.query)

            # Loại bỏ các link hệ thống/bài viết (check trong path, không phải query)
            bad_paths = ["/posts/", "/videos/", "/watch/", "/story.php", 
                        "/photo", "/photo.php", "/sharer.php", "/hashtag/",
                        "/reel/", "/share/", "/groups/"]
            if any(x in path for x in bad_paths):
                return "Unknown"

            # Case 1: profile.php?id=1000xxx
            if "profile.php" in path:
                if 'id' in query:
                    return query['id'][0]
            
            # Case 2: /people/Name/1000xxx
            if "/people/" in path:
                parts = path.strip("/").split("/")
                for part in reversed(parts):
                    if part.isdigit():
                        return part
                if len(parts) >= 2:
                    return parts[-1]

            # Case 3: /username hoặc /username?comment_id=xxx
            # Path: /luong.tuantai.0987748389 -> lấy luong.tuantai.0987748389
            path_parts = path.strip("/").split("/")
            if path_parts:
                candidate = path_parts[0]
                # Loại bỏ các từ khóa hệ thống
                system_words = ["watch", "groups", "gaming", "pages", "friends", 
                               "events", "messages", "media", "dialog", "share",
                               "reel", "story", "stories", "marketplace", "gaming",
                               "live", "events", "fundraisers", "saved", "offers"]
                if candidate and candidate.lower() not in system_words:
                    # Validate: username FB thường có chữ cái, số, dấu chấm
                    # Không phải chỉ toàn số (đó có thể là ID bài viết)
                    if not candidate.isdigit() or len(candidate) > 10:
                        return candidate
        except Exception as e:
            logger.debug(f"Error extracting FB user ID from {url}: {e}")
        return "Unknown"
    
    def _switch_to_all_comments(self):
        """
        Chuyển bộ lọc từ 'Phù hợp nhất' sang 'Tất cả bình luận'
        Bỏ qua nếu gặp lỗi (không ảnh hưởng scraping)
        """
        logger.info("🔄 Đang chuyển bộ lọc 'Tất cả bình luận'...")
        try:
            # Kiểm tra tab còn hoạt động không
            try:
                _ = self.driver.current_url
            except:
                logger.warning("⚠️ Tab không phản hồi, bỏ qua chuyển filter")
                return False
            
            # Click vào nút filter hiện tại - timeout ngắn hơn
            filter_xpath = "//span[contains(text(), 'Phù hợp nhất') or contains(text(), 'Most relevant')]"
            trigger = WebDriverWait(self.driver, 3).until(
                EC.presence_of_element_located((By.XPATH, filter_xpath))
            )
            self.driver.execute_script(
                "arguments[0].scrollIntoView({block: 'center'}); arguments[0].click();", 
                trigger
            )
            time.sleep(1.0)
            
            # Chọn "Tất cả bình luận"
            all_xpath = "//span[contains(text(), 'Tất cả bình luận') or contains(text(), 'All comments')]"
            option = WebDriverWait(self.driver, 3).until(
                EC.presence_of_element_located((By.XPATH, all_xpath))
            )
            self.driver.execute_script("arguments[0].click();", option)
            logger.info("✅ Đã chuyển bộ lọc sang 'Tất cả bình luận'!")
            time.sleep(1.5)
            return True
        except Exception as e:
            # Không crash, chỉ warning và tiếp tục
            error_msg = str(e)
            if 'tab crashed' in error_msg.lower() or 'session' in error_msg.lower():
                logger.warning("⚠️ Tab gặp vấn đề, bỏ qua chuyển filter và tiếp tục...")
            else:
                logger.warning(f"⚠️ Không tìm thấy bộ lọc (Có thể đã đúng sẵn): {e}")
            return False
    
    def _get_scroll_target(self):
        """
        Lấy element để scroll (dialog hoặc document)
        """
        try:
            return self.driver.find_element(By.CSS_SELECTOR, 'div[role="dialog"]')
        except:
            pass
        try:
            return self.driver.execute_script(
                "return document.scrollingElement || document.documentElement;"
            )
        except:
            return None

    def _find_fb_scroll_container(self):
        """
        Tìm container thực sự có thể scroll trong dialog/comment section.
        Ưu tiên element có scrollHeight lớn nhất.
        """
        best_el = None
        best_delta = 0

        # Ưu tiên dialog nếu có
        try:
            dialog = self.driver.find_element(By.CSS_SELECTOR, 'div[role="dialog"]')
            candidates = dialog.find_elements(By.CSS_SELECTOR, 'div')
            for el in candidates:
                try:
                    dims = self.driver.execute_script(
                        "return {sh: arguments[0].scrollHeight, ch: arguments[0].clientHeight};",
                        el
                    )
                    if dims and dims.get('sh') and dims.get('ch'):
                        delta = dims['sh'] - dims['ch']
                        if delta > 40 and delta > best_delta:
                            best_delta = delta
                            best_el = el
                except:
                    continue
        except:
            pass

        # Fallback: comment section ngoài dialog
        if not best_el:
            try:
                sections = self.driver.find_elements(
                    By.CSS_SELECTOR,
                    'div[data-pagelet*="Comment"], div[aria-label*="Comment"], div[aria-label*="Bình luận"]'
                )
                for el in sections:
                    try:
                        dims = self.driver.execute_script(
                            "return {sh: arguments[0].scrollHeight, ch: arguments[0].clientHeight};",
                            el
                        )
                        if dims and dims.get('sh') and dims.get('ch'):
                            delta = dims['sh'] - dims['ch']
                            if delta > 40 and delta > best_delta:
                                best_delta = delta
                                best_el = el
                    except:
                        continue
            except:
                pass

        if best_el:
            try:
                logger.info(f"🔎 FB scroll container found (delta={best_delta})")
            except:
                pass
        else:
            logger.info("🔎 FB scroll container not found")
        return best_el

    def _get_scroll_state(self, container=None):
        """Lấy trạng thái scroll hiện tại của container hoặc window."""
        try:
            if container:
                return self.driver.execute_script(
                    "return {top: arguments[0].scrollTop, sh: arguments[0].scrollHeight, ch: arguments[0].clientHeight};",
                    container
                )
        except:
            pass
        try:
            return self.driver.execute_script(
                "return {top: window.pageYOffset || document.documentElement.scrollTop || 0, sh: document.body.scrollHeight, ch: window.innerHeight};"
            )
        except:
            return {'top': 0, 'sh': 0, 'ch': 0}

    def _drag_scrollbar(self, container, drag_pixels=600):
        """Kéo thanh cuộn của container để mô phỏng người dùng."""
        try:
            if not container or not container.is_displayed():
                return False

            size = container.size
            width = size.get('width', 0)
            height = size.get('height', 0)
            if width <= 0 or height <= 0:
                return False

            # Kéo gần mép phải (scrollbar) của container
            x_offset = max(width - 3, 1)
            y_offset = int(height * 0.6)
            ActionChains(self.driver)\
                .move_to_element_with_offset(container, x_offset, y_offset)\
                .click_and_hold()\
                .move_by_offset(0, drag_pixels)\
                .release()\
                .perform()
            return True
        except Exception as e:
            logger.debug(f"FB drag scrollbar error: {e}")
            return False

    def _is_fb_reply_comment(self, element):
        """Loại comment cấp 2 trở xuống (reply)."""
        try:
            reply_ancestors = element.find_elements(
                By.XPATH,
                "./ancestor::*[contains(@aria-label, 'Reply') or contains(@aria-label, 'Trả lời') or contains(@aria-label, 'replies') or contains(@aria-label, 'phản hồi')]"
            )
            return len(reply_ancestors) > 0
        except:
            return False
    
    def _click_view_more_comments(self):
        """
        Click vào các nút 'Xem thêm bình luận' - TỐI ƯU TỐC ĐỘ
        Returns: số lượng nút đã click
        """
        clicked = 0
        try:
            # Chỉ dùng 4 xpath phổ biến nhất
            view_more_xpaths = [
                "//span[contains(text(), 'Xem thêm bình luận') or contains(text(), 'View more comments')]",
                "//span[contains(text(), 'Xem thêm phản hồi') or contains(text(), 'View more replies')]",
                "//span[contains(text(), 'bình luận trước') or contains(text(), 'previous comments')]",
                "//span[contains(text(), 'phản hồi') or contains(text(), 'replies')]",
            ]
            
            for xpath in view_more_xpaths:
                try:
                    buttons = self.driver.find_elements(By.XPATH, xpath)
                    for btn in buttons[:3]:  # Click tối đa 3 nút mỗi loại
                        try:
                            if btn.is_displayed():
                                self.driver.execute_script("arguments[0].click();", btn)
                                clicked += 1
                                time.sleep(0.3)
                        except:
                            continue
                except:
                    continue
            
            if clicked > 0:
                logger.info(f"   📌 Đã click {clicked} nút 'Xem thêm'")
                time.sleep(0.5)
            
            return clicked
        except Exception as e:
            logger.debug(f"Không tìm thấy nút xem thêm: {e}")
            return 0
    
    def _fb_scroll(self):
        """
        Scroll đặc biệt cho Facebook - scroll cả dialog và window
        Returns: True nếu scroll được
        """
        try:
            # Debug: kiểm tra dialog/scrollable trong DOM
            try:
                has_dialog = self.driver.find_elements(By.CSS_SELECTOR, 'div[role="dialog"]')
                logger.debug(f"FB scroll: dialog count = {len(has_dialog)}")
            except Exception as e:
                logger.debug(f"FB scroll: lỗi check dialog: {e}")

            # Non-headless: hover/scroll vào container comment thực sự (không click)
            try:
                scroll_container = self._find_fb_scroll_container()
                if scroll_container and scroll_container.is_displayed():
                    ActionChains(self.driver).move_to_element(scroll_container).perform()
                    try:
                        ActionChains(self.driver).move_to_element(scroll_container).scroll_by_amount(0, 700).perform()
                    except Exception:
                        pass
                    # Kéo scrollbar để mô phỏng người dùng
                    self._drag_scrollbar(scroll_container, drag_pixels=800)
            except Exception as e:
                logger.debug(f"FB scroll: không focus được vùng comment: {e}")

            self.driver.execute_script("""
            function findScrollable(el) {
                var node = el;
                while (node) {
                    if (node.scrollHeight > node.clientHeight + 20) {
                        return node;
                    }
                    node = node.parentElement;
                }
                return null;
            }

            function wheelScroll(el, deltaY) {
                if (!el) return;
                try {
                    var evt = new WheelEvent('wheel', {deltaY: deltaY, bubbles: true, cancelable: true});
                    el.dispatchEvent(evt);
                } catch (e) {}
            }

            function scrollEl(el) {
                if (!el) return;
                try {
                    el.scrollTop = el.scrollTop + Math.max(600, el.clientHeight * 1.5);
                    wheelScroll(el, 1200);
                } catch (e) {}
            }

            // Ưu tiên scroll container của comment item nếu có
            var commentItem = document.querySelector('div[role="article"]');
            if (commentItem) {
                var scrollable = findScrollable(commentItem);
                scrollEl(scrollable);
            }

            // Không scroll window để tránh cuộn ngoài vùng comment
            """)

            # Scroll trực tiếp container được tìm thấy (nếu có)
            try:
                container = self._find_fb_scroll_container()
                if container:
                    self.driver.execute_script(
                        "arguments[0].scrollTop = arguments[0].scrollTop + Math.max(600, arguments[0].clientHeight * 1.5);",
                        container
                    )
                    self._drag_scrollbar(container, drag_pixels=800)
            except Exception as e:
                logger.debug(f"FB scroll: không scroll được container: {e}")
            return True
        except Exception as e:
            logger.debug(f"Lỗi scroll: {e}")
            return False

    def _fb_scroll_with_retry(self, wait_schedule=(0.0, 0.0, 0.0)):
        """
        Scroll Facebook + retry tối đa 3 lần.
        Mỗi lần retry: cuộn lên rồi cuộn xuống lại, không chờ.
        """
        try:
            container = self._find_fb_scroll_container()
            logger.info(f"🔄 FB scroll retry start (waits={wait_schedule})")

            for idx, wait_s in enumerate(wait_schedule, start=1):
                before = self._get_scroll_state(container)
                self._fb_scroll()
                if wait_s > 0:
                    time.sleep(wait_s)

                after = self._get_scroll_state(container)
                moved = (after.get('top', 0) > before.get('top', 0))
                logger.info(f"   ⏱️ attempt {idx}: moved={moved} (top {before.get('top', 0)} -> {after.get('top', 0)})")
                if moved:
                    return True

                # Scroll lên rồi xuống lại để kích hoạt load
                if container:
                    self.driver.execute_script(
                        "arguments[0].scrollTop = Math.max(0, arguments[0].scrollTop - 400);",
                        container
                    )
                time.sleep(0.2)
                if container:
                    self.driver.execute_script(
                        "arguments[0].scrollTop = arguments[0].scrollTop + Math.max(600, arguments[0].clientHeight * 1.5);",
                        container
                    )
                if wait_s > 0:
                    time.sleep(wait_s)

                after_retry = self._get_scroll_state(container)
                moved_retry = (after_retry.get('top', 0) > before.get('top', 0))
                logger.info(f"   🔁 retry {idx}: moved={moved_retry} (top {before.get('top', 0)} -> {after_retry.get('top', 0)})")
                if moved_retry:
                    return True

                logger.info(f"⏳ Đang thử cuộn lại... ({idx}/{len(wait_schedule)})")

            return False
        except Exception as e:
            logger.debug(f"Lỗi scroll retry: {e}")
            return False

    def _fb_scroll_burst(self, container, burst_count=15, interval_sec=0.06):
        """Cuộn nhanh liên tục theo burst, trả về True nếu có load thêm."""
        try:
            if not container:
                return False
            before = self._get_scroll_state(container)
            step = max(900, int(before.get('ch', 0) * 1.8))
            for _ in range(burst_count):
                self.driver.execute_script(
                    "arguments[0].scrollTop = arguments[0].scrollTop + arguments[1];",
                    container,
                    step
                )
                if interval_sec > 0:
                    time.sleep(interval_sec)
            after = self._get_scroll_state(container)
            moved = (after.get('top', 0) > before.get('top', 0)) or (after.get('sh', 0) > before.get('sh', 0))
            logger.info(
                f"⚡ FB burst: moved={moved} (top {before.get('top', 0)} -> {after.get('top', 0)}; sh {before.get('sh', 0)} -> {after.get('sh', 0)})"
            )
            return moved
        except Exception as e:
            logger.debug(f"FB burst scroll error: {e}")
            return False
    
    def _find_comment_elements(self, container):
        """
        Tìm các comment elements trong container
        Theo code tham khảo: dùng div[role="article"] hoặc div[aria-label]
        
        Returns: list of WebElements
        """
        # Cách 1: Tìm div[role="article"] (phổ biến nhất)
        comments = container.find_elements(By.CSS_SELECTOR, 'div[role="article"]')
        
        # Cách 2: Fallback nếu không đủ
        if len(comments) < 2:
            comments = container.find_elements(By.CSS_SELECTOR, 'div[aria-label]')
        
        return comments
    
    def scrape(self, url, cookie_data=None):
        """
        Scrape comment từ video/post Facebook
        
        Args:
            url: URL video/post Facebook
            cookie_data: Dict/List chứa cookies (optional)
            
        Returns:
            list: Danh sách dictionary chứa thông tin comment
        """
        comments = []
        data_set = set()  # Để loại bỏ duplicate
        
        try:
            logger.info(f"🚀 Bắt đầu scrape Facebook: {url}")
            
            # Khởi tạo driver với window width 420px (theo code tham khảo)
            self.driver = self._setup_driver(mobile_view=False)
            
            # Set window size 420px cho Facebook (tối ưu hơn desktop view)
            try:
                self.driver.maximize_window()
                time.sleep(0.3)
                h = self.driver.get_window_size()["height"]
                self.driver.set_window_rect(x=0, y=0, width=420, height=h)
            except:
                pass
            
            # Nếu có cookie, truy cập facebook.com trước để apply
            if cookie_data:
                logger.info("🍪 Đang nạp cookies...")
                self.driver.get("https://www.facebook.com")
                time.sleep(0.8)
                if self._apply_cookies(cookie_data):
                    logger.info("✅ Đã nạp cookies thành công")
                    self.driver.refresh()
                    time.sleep(1.0)
                else:
                    logger.warning("⚠️ Không thể nạp cookies - Chạy không đăng nhập")
            else:
                logger.info("⚠️ Chạy không cookie (Có thể cần đăng nhập)")
            
            # Truy cập URL
            logger.info("🌍 Đang vào bài viết...")
            self.driver.get(url)
            time.sleep(1.5)
            
            # Chờ trang load - thử nhiều selectors
            page_loaded = False
            load_selectors = [
                'div[role="article"]',
                'div[role="main"]',
                'div[data-pagelet="MainFeed"]',
                'div.x1yztbdb',  # Container class mới của FB
            ]
            
            for selector in load_selectors:
                try:
                    WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                    )
                    logger.info(f"✅ Trang đã load (selector: {selector})")
                    page_loaded = True
                    break
                except:
                    continue
            
            if not page_loaded:
                logger.warning("⚠️ Không tìm thấy container chính, tiếp tục...")
            
            # Kiểm tra captcha - DỪNG NGAY nếu phát hiện
            self._wait_for_captcha_if_present(platform='facebook')
            
            # Chuyển bộ lọc sang "Tất cả bình luận" - RẤT QUAN TRỌNG!
            self._switch_to_all_comments()
            
            # Scroll xuống để load comment section
            logger.info("   📜 Scroll để load comments...")
            self.driver.execute_script("window.scrollTo(0, 800);")
            time.sleep(1)
            
            logger.info("   📜 Đang cuộn đến cuối (không click 'Xem thêm')...")
            debug_logged = False
            no_more_scroll = 0

            container_cache = None
            while True:
                if not debug_logged:
                    try:
                        dialog_count = len(self.driver.find_elements(By.CSS_SELECTOR, 'div[role="dialog"]'))
                        logger.info(f"🔎 FB debug: dialog count = {dialog_count}")
                    except Exception as e:
                        logger.info(f"🔎 FB debug: không check được dialog ({e})")
                    debug_logged = True

                if not container_cache or not container_cache.is_displayed():
                    container_cache = self._find_fb_scroll_container()
                can_scroll = self._fb_scroll_burst(container_cache, burst_count=15, interval_sec=0.06)
                if not can_scroll:
                    no_more_scroll += 1
                    logger.info(f"⏳ Không có data mới, retry {no_more_scroll}/3...")
                    # Thử scroll ngược lên rồi xuống để kích hoạt load
                    if no_more_scroll < 3 and container_cache:
                        self.driver.execute_script(
                            "arguments[0].scrollTop = Math.max(0, arguments[0].scrollTop - 500);",
                            container_cache
                        )
                        time.sleep(0.5)
                        self.driver.execute_script(
                            "arguments[0].scrollTop = arguments[0].scrollHeight;",
                            container_cache
                        )
                        time.sleep(1.0)
                else:
                    no_more_scroll = 0

                if no_more_scroll >= 3:
                    logger.info("🛑 Đã cuộn tới cuối, bắt đầu quét comment...")
                    break

            # ===== BẮT ĐẦU QUÉT COMMENT (CHỈ CẤP 1) =====
            # Tìm container (dialog hoặc page)
            try:
                container = self.driver.find_element(By.CSS_SELECTOR, 'div[role="dialog"]')
            except:
                container = self.driver

            comment_elements = self._find_comment_elements(container)
            count_new = 0

            for item in comment_elements:
                try:
                    # Chỉ lấy comment cấp 1 (bỏ reply)
                    if self._is_fb_reply_comment(item):
                        continue
                    # Lấy User ID từ link
                    user_id = "Unknown"
                    try:
                        links = item.find_elements(By.TAG_NAME, "a")
                        for link in links:
                            href = link.get_attribute("href")
                            if not href:
                                continue
                            
                            # Bỏ qua link hashtag, share, posts, videos
                            if any(x in href for x in ["/hashtag/", "sharer.php", "l.php", "/posts/", "/videos/", "/watch/"]):
                                continue
                            
                            extracted = self._extract_fb_user_id(href)
                            if extracted != "Unknown":
                                user_id = extracted
                                break
                    except:
                        pass
                    
                    # Lấy emoji từ img trong div[dir='auto']
                    emoji_text = ""
                    try:
                        content_div = item.find_element(By.CSS_SELECTOR, "div[dir='auto']")
                        imgs = content_div.find_elements(By.TAG_NAME, "img")
                        for img in imgs:
                            alt = img.get_attribute("alt")
                            if alt:
                                emoji_text += alt + " "
                    except:
                        pass
                    
                    # Lấy raw text và lọc
                    raw_text = item.text.strip()
                    if not raw_text and not emoji_text:
                        continue
                    
                    all_lines = raw_text.split('\n')
                    # Lọc rác (thời gian, reply, like...)
                    clean_lines = [line for line in all_lines if not self._is_junk_line(line)]
                    
                    # --- LOGIC FIX LỖI LẤY TÊN ---
                    # Facebook luôn xếp: [Dòng 1: Tên] [Dòng 2 trở đi: Nội dung]
                    # Vì vậy ta LUÔN LUÔN bỏ dòng đầu tiên (clean_lines[0])
                    comment_content = ""
                    if len(clean_lines) >= 2:
                        # Có từ 2 dòng trở lên -> Dòng 1 là tên -> Lấy từ dòng 2
                        comment_content = "\n".join(clean_lines[1:])
                    elif len(clean_lines) == 1:
                        # Nếu chỉ còn 1 dòng duy nhất -> 99% đó là Tên (vì nội dung rỗng hoặc chỉ có ảnh)
                        comment_content = ""
                    
                    # Ghép text với emoji
                    final_content = (comment_content + " " + emoji_text).strip()
                    
                    # Nếu sau khi lọc mà rỗng thì gán nhãn
                    if not final_content:
                        final_content = "[Ảnh/Sticker/GIF]"
                    
                    # === LẤY LƯỢT THÍCH (LIKES) ===
                    likes = 0
                    try:
                        # Cách 1: Tìm aria-label chứa số lượt thích
                        like_elements = item.find_elements(
                            By.XPATH,
                            ".//*[contains(@aria-label, 'like') or contains(@aria-label, 'thích') or contains(@aria-label, 'reaction') or contains(@aria-label, 'cảm xúc')]"
                        )
                        for el in like_elements:
                            aria = el.get_attribute("aria-label") or ""
                            # Parse số từ "1 like", "5 reactions", "3 lượt thích"
                            match = re.search(r'(\d+)', aria)
                            if match:
                                likes = int(match.group(1))
                                break
                        
                        # Cách 2: Tìm span/div có role="button" gần reaction icon
                        if likes == 0:
                            reaction_containers = item.find_elements(
                                By.XPATH,
                                ".//div[@role='button']//span[string-length(text()) <= 5] | .//span[@role='button']//span[string-length(text()) <= 5]"
                            )
                            for span in reaction_containers:
                                txt = span.text.strip()
                                if txt and txt.isdigit():
                                    likes = int(txt)
                                    break
                        
                        # Cách 3: Tìm text số nhỏ gần cuối comment
                        if likes == 0:
                            small_texts = item.find_elements(
                                By.XPATH,
                                ".//span[string-length(normalize-space(text())) <= 4]"
                            )
                            for span in small_texts:
                                txt = span.text.strip()
                                if txt and txt.isdigit() and 0 < int(txt) < 10000:
                                    # Kiểm tra không phải timestamp
                                    parent = span.find_element(By.XPATH, "./..")
                                    parent_text = parent.text.lower() if parent else ""
                                    if not any(x in parent_text for x in ['giờ', 'phút', 'ngày', 'tuần', 'h ', 'm ', 'd ', 'w ']):
                                        likes = int(txt)
                                        break
                    except Exception as e:
                        logger.debug(f"Lỗi lấy likes: {e}")
                    
                    # Loại bỏ duplicate
                    unique_key = (user_id, final_content)
                    
                    if unique_key not in data_set:
                        data_set.add(unique_key)
                        comments.append({
                            'username': user_id,
                            'content': final_content,
                            'likes': likes
                        })
                        count_new += 1
                        
                        # Log gọn (có likes nếu > 0)
                        likes_str = f" [{likes} ❤️]" if likes > 0 else ""
                        short_text = final_content[:30].replace('\n', ' ')
                        logger.info(f"   + {user_id}: {short_text}...{likes_str}")
                
                except StaleElementReferenceException:
                    continue
                except:
                    continue

            if count_new > 0:
                logger.info(f"✅ Lấy thêm {count_new} (Tổng: {len(comments)})")
                self._notify_progress(len(comments), f'Đã cào {len(comments)} bình luận')
            
            logger.info(f"\n🎉 Đã scrape được {len(comments)} comment")
            return comments
            
        except (BotDetectedException, URLNotFoundException, CaptchaDetectedException):
            raise
        except WebDriverException as e:
            raise ScraperException(f"Lỗi WebDriver: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Lỗi không xác định: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise ScraperException(f"Lỗi không xác định: {str(e)}")
        finally:
            self.close()


# ===========================================
# TikTokCookieGrabber - Lấy cookie tự động
# ===========================================
class TikTokCookieGrabber:
    """
    Class để mở browser thật (non-headless) cho người dùng
    đăng nhập TikTok và giải captcha, sau đó lấy cookie.
    
    Giống cách hoạt động của extension ExportComments.
    """
    
    def __init__(self):
        self.driver = None
        self.status = 'idle'  # idle, waiting, ready, closed
        self.cookies = None
    
    def _setup_visible_browser(self):
        """
        Khởi tạo Chrome browser KHÔNG headless (hiện cửa sổ)
        để người dùng có thể đăng nhập và giải captcha
        """
        chrome_options = Options()
        
        # KHÔNG dùng headless - hiện cửa sổ cho user
        chrome_options.add_argument("--disable-notifications")
        chrome_options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        
        # Window size phù hợp
        chrome_options.add_argument('--window-size=500,800')
        chrome_options.add_argument('--window-position=100,100')
        
        # User-Agent thực tế
        user_agent = get_random_user_agent(mobile=False)
        chrome_options.add_argument(f'user-agent={user_agent}')
        
        # Stealth preferences
        prefs = {
            'credentials_enable_service': False,
            'profile.password_manager_enabled': False,
        }
        chrome_options.add_experimental_option('prefs', prefs)
        
        # Tìm ChromeDriver
        driver_path = os.environ.get("CHROMEDRIVER_PATH")
        if driver_path:
            service = Service(driver_path)
        else:
            system_chromedriver = shutil.which("chromedriver")
            if system_chromedriver:
                service = Service(system_chromedriver)
            else:
                service = Service(ChromeDriverManager().install())
        
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Inject stealth scripts
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                })
            '''
        })
        
        return driver
    
    def start(self):
        """
        Mở browser và điều hướng đến TikTok login
        
        Returns:
            dict: Status và message
        """
        try:
            if self.driver:
                self.close()
            
            logger.info("🚀 Đang mở browser để lấy cookie TikTok...")
            self.driver = self._setup_visible_browser()
            self.status = 'waiting'
            
            # Truy cập TikTok
            self.driver.get("https://www.tiktok.com/login")
            
            logger.info("✅ Browser đã mở! Vui lòng đăng nhập TikTok và giải captcha nếu có.")
            
            return {
                'success': True,
                'status': 'waiting',
                'message': 'Browser đã mở! Vui lòng đăng nhập TikTok trong cửa sổ Chrome vừa mở.'
            }
            
        except Exception as e:
            logger.error(f"❌ Lỗi mở browser: {e}")
            self.status = 'error'
            return {
                'success': False,
                'status': 'error',
                'message': f'Lỗi mở browser: {str(e)}'
            }
    
    def check_login_status(self):
        """
        Kiểm tra xem người dùng đã đăng nhập TikTok chưa
        
        Returns:
            dict: Status và thông tin đăng nhập
        """
        if not self.driver:
            return {
                'success': False,
                'logged_in': False,
                'message': 'Browser chưa được mở'
            }
        
        try:
            current_url = self.driver.current_url
            
            # Kiểm tra đã login chưa bằng cách tìm các dấu hiệu
            # 1. Không còn ở trang login
            # 2. Có cookie sessionid
            
            cookies = self.driver.get_cookies()
            cookie_names = [c['name'] for c in cookies]
            
            has_session = 'sessionid' in cookie_names
            has_mstoken = 'msToken' in cookie_names
            not_on_login = '/login' not in current_url
            
            logged_in = has_session and not_on_login
            
            if logged_in:
                self.status = 'ready'
                logger.info("✅ Phát hiện đã đăng nhập TikTok!")
                return {
                    'success': True,
                    'logged_in': True,
                    'has_session': has_session,
                    'has_mstoken': has_mstoken,
                    'cookie_count': len(cookies),
                    'message': 'Đã đăng nhập! Bạn có thể lấy cookie ngay.'
                }
            else:
                return {
                    'success': True,
                    'logged_in': False,
                    'has_session': has_session,
                    'current_url': current_url,
                    'message': 'Chưa đăng nhập. Vui lòng đăng nhập trong cửa sổ Chrome.'
                }
                
        except Exception as e:
            logger.error(f"Lỗi kiểm tra login: {e}")
            return {
                'success': False,
                'logged_in': False,
                'message': f'Lỗi: {str(e)}'
            }
    
    def grab_cookies(self):
        """
        Lấy tất cả cookies từ browser sau khi đã đăng nhập
        
        Returns:
            dict: Cookies và status
        """
        if not self.driver:
            return {
                'success': False,
                'message': 'Browser chưa được mở'
            }
        
        try:
            # Đảm bảo đang ở trang TikTok
            current_url = self.driver.current_url
            if 'tiktok.com' not in current_url:
                self.driver.get("https://www.tiktok.com")
                time.sleep(2)
            
            # Lấy tất cả cookies
            cookies = self.driver.get_cookies()
            
            if not cookies:
                return {
                    'success': False,
                    'message': 'Không tìm thấy cookie nào!'
                }
            
            # Kiểm tra các cookie quan trọng
            cookie_names = [c['name'] for c in cookies]
            important = ['msToken', 'sessionid', 'ttwid', 'tt_csrf_token', 's_v_web_id']
            found = [c for c in important if c in cookie_names]
            missing = [c for c in important if c not in cookie_names]
            
            # Format cookies cho J2TEAM style
            formatted_cookies = {
                'url': 'https://www.tiktok.com',
                'cookies': cookies
            }
            
            self.cookies = formatted_cookies
            
            logger.info(f"✅ Đã lấy {len(cookies)} cookies!")
            logger.info(f"🔑 Cookie quan trọng: {', '.join(found)}")
            if missing:
                logger.warning(f"⚠️ Thiếu: {', '.join(missing)}")
            
            return {
                'success': True,
                'cookies': formatted_cookies,
                'cookie_count': len(cookies),
                'important_found': found,
                'important_missing': missing,
                'message': f'Đã lấy {len(cookies)} cookies thành công!'
            }
            
        except Exception as e:
            logger.error(f"❌ Lỗi lấy cookies: {e}")
            return {
                'success': False,
                'message': f'Lỗi: {str(e)}'
            }
    
    def navigate_to_video(self, video_url):
        """
        Điều hướng đến video TikTok cụ thể để warm up cookies
        
        Args:
            video_url: URL video TikTok
        """
        if not self.driver:
            return {'success': False, 'message': 'Browser chưa mở'}
        
        try:
            self.driver.get(video_url)
            time.sleep(3)
            
            # Kiểm tra captcha
            captcha_selectors = [
                '.captcha-verify-container',
                '[class*="captcha"]',
                '.secsdk-captcha-drag-wrapper'
            ]
            
            has_captcha = False
            for selector in captcha_selectors:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                for el in elements:
                    if el.is_displayed():
                        has_captcha = True
                        break
            
            if has_captcha:
                return {
                    'success': True,
                    'has_captcha': True,
                    'message': 'Phát hiện captcha! Vui lòng giải trong cửa sổ Chrome.'
                }
            
            return {
                'success': True,
                'has_captcha': False,
                'message': 'Đã truy cập video thành công!'
            }
            
        except Exception as e:
            return {'success': False, 'message': f'Lỗi: {str(e)}'}
    
    def close(self):
        """Đóng browser"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None
        self.status = 'closed'
        logger.info("🔒 Đã đóng browser")
    
    def get_status(self):
        """Lấy trạng thái hiện tại"""
        return {
            'status': self.status,
            'has_browser': self.driver is not None,
            'has_cookies': self.cookies is not None
        }


# Global instance cho cookie grabber (singleton pattern)
_cookie_grabber_instance = None

def get_cookie_grabber():
    """Lấy instance của TikTokCookieGrabber (singleton)"""
    global _cookie_grabber_instance
    if _cookie_grabber_instance is None:
        _cookie_grabber_instance = TikTokCookieGrabber()
    return _cookie_grabber_instance


def get_scraper(url, headless=True, proxy=None):
    """
    Factory function để lấy scraper phù hợp dựa trên URL
    
    Args:
        url: URL cần scrape
        headless: Chạy ở chế độ headless
        proxy: Proxy string (địa chỉ proxy)
        
    Returns:
        BaseScraper: Instance của scraper phù hợp
        
    Raises:
        ValueError: Nếu URL không thuộc platform được hỗ trợ
    """
    url_lower = url.lower()
    
    if 'tiktok.com' in url_lower:
        return TikTokScraper(headless=headless, proxy=proxy)
    elif 'facebook.com' in url_lower or 'fb.watch' in url_lower:
        return FacebookScraper(headless=headless, proxy=proxy)
    else:
        raise ValueError("URL không thuộc TikTok hoặc Facebook")


def detect_platform(url):
    """
    Phát hiện platform từ URL
    
    Args:
        url: URL cần kiểm tra
        
    Returns:
        str: Tên platform ('tiktok' hoặc 'facebook')
        
    Raises:
        ValueError: Nếu không nhận diện được platform
    """
    url_lower = url.lower()
    
    if 'tiktok.com' in url_lower:
        return 'tiktok'
    elif 'facebook.com' in url_lower or 'fb.watch' in url_lower:
        return 'facebook'
    else:
        raise ValueError("Không nhận diện được platform từ URL")
