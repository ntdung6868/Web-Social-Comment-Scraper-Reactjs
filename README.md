# Web Scraper - Công cụ Cào Comment TikTok/Facebook

Ứng dụng Web Scraping chuyên nghiệp được xây dựng bằng Python Flask, cho phép cào comment từ video TikTok và Facebook với hệ thống quản lý người dùng và bảo mật nghiêm ngặt.

## ✨ Tính năng chính

- **🔐 Authentication**: Đăng ký/Đăng nhập với mã hóa PBKDF2 (600k iterations), bảo vệ CSRF
- **🕷️ Web Scraping**: Tự động cào comment từ TikTok và Facebook bằng Selenium
- **📜 Auto-scroll**: Tự động cuộn trang để lấy tất cả comment
- **📊 Export Excel**: Xuất dữ liệu ra file Excel chuyên nghiệp với định dạng đẹp
- **🎨 Dashboard**: Giao diện hiện đại với Tailwind CSS
- **📅 Lịch sử**: Lưu và quản lý lịch sử các lần scrape
- **🍪 Cookie Management**: Hỗ trợ upload cookie cho từng platform
- **🌐 Proxy Support**: Hỗ trợ proxy với xoay vòng (random/sequential)
- **🔧 Headless Mode**: Chế độ headless hoặc hiện cửa sổ Chrome
- **⚡ Real-time Progress**: Hiển thị tiến độ scraping real-time

## 📁 Cấu trúc dự án

```
web-scraper/
├── app/
│   ├── __init__.py              # Khởi tạo Flask application và extensions
│   ├── models.py                # Database models (User, ScrapeHistory, Comment)
│   ├── auth.py                  # Forms và logic authentication
│   ├── scraper.py               # Logic Selenium scraping (1500+ lines)
│   ├── routes.py                # Routes và API endpoints (750+ lines)
│   ├── utils.py                 # Utility functions (export Excel, format time, etc.)
│   ├── __pycache__/             # Cache files (được ignore)
│   ├── templates/               # HTML templates (Jinja2)
│   │   ├── base.html            # Base template với navbar
│   │   ├── login.html           # Trang đăng nhập
│   │   ├── register.html        # Trang đăng ký
│   │   ├── dashboard.html       # Dashboard chính (420+ lines)
│   │   ├── history_detail.html  # Chi tiết lịch sử scrape
│   │   └── settings.html        # Cài đặt cookie, proxy, headless mode
│   └── static/
│       ├── css/
│       │   └── style.css        # Custom Tailwind CSS
│       ├── icon/                # Icons folder
│       └── js/
│           └── main.js          # Frontend JavaScript
├── instance/                    # Instance folder (database, config)
├── venv/                        # Virtual environment (được ignore)
├── .gitignore                   # Git ignore rules
├──📋 Yêu cầu hệ thống

- **Python**: 3.9+
- **Google Chrome/Chromium**: Phiên bản gần đây (cho Selenium)
- **OS**: macOS, Linux, hoặc Windows
- **RAM**: 2GB trở lên (khuyến nghị)
- **Disk**: 500MB trở lên cho venv và database            # Documentation
```

## Yêu cầu hệ thống

- Python 3.9+
- Google Chrome (hoặc Chromium)
- m🚀 Cài đặt

### 1. Clone hoặc di chuyển vào thư mục dự án

```bash
cd web-scraper
```

### 2. Tạo môi trường ảo (khuyến nghị)

```bash
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows
.\venv\Scripts\activate
```

### 3. Cài đặt dependencies

```bash
pip install -r requirements.txt
```

### 4. Cấu hình môi trường

Tạo file `.env` từ template (hoặc chỉnh sửa file `.env` có sẵn):

```env
# Secret Key - QUAN TRỌNG: Thay đổi trong production
SECRET_KEY=your-super-secret-key-change-in-production

# Database URL
DATABASE_URL=sqlite:///instance/scraper.db

# Cấu hình Scraper
HEADLESS_MODE=True
SCROLL_PAUSE_TIME=2
MAX_SCROLL_COUNT=10

# Flask Configuration
FLASK_DEBUG=True
FLASK_HOST=0.0.0.0
FLASK_PORT=5000

# (Optional) Nếu có ChromeDriver riêng, set path này
# CHROMEDRIVER_PATH=/path/to/chromedriver
```

\*\*C🏗️ Kiến trúc

### Database Models

**User**

- id, username (unique), email (unique)
- password_hash (PBKDF2:SHA256)
- tiktok_cookie_file, tiktok_cookie_data, use_tiktok_cookie
- facebook_cookie_file, facebook_cookie_data, use_facebook_cookie
- proxy_enabled, proxy_list, proxy_rotation, current_proxy_index
- headless_mode, created_at, is_active

**ScrapeHistory**

- id, user_id (FK), platform, url
- total_comments, status (pending/success/failed)
- error_message, created_at

**Comment**

- id, scrape_history_id (FK)
- username, content, timestamp
- likes, scraped_at

### API Endpoints

| Method | Endpoint                   | Mô tả                   |
| ------ | -------------------------- | ----------------------- |
| POST   | `/api/scrape`              | Bắt đầu scrape từ URL   |
| GET    | `/api/scrape/progress`     | Lấy tiến độ scraping    |
| GET    | `/api/export/<history_id>` | Export history ra Excel |

### Authentication & Security

- **Password Hashing**: PBKDF2:SHA256 với 600,000 iterations
- **CSRF Protection**: Bảo vệ CSRF token trên tất cả form
- **Session Security**: HTTPOnly, SameSite=Lax cookies
- **URL Validation**: Kiểm tra domain TikTok/Facebook

## 🔧 Troubleshooting

### Lỗi: "ChromeDriver version mismatch"

**Giải pháp**: Xóa cache webdriver-manager và tải lại

```bash
rm -rf ~/.wdm  # macOS/Linux
# hoặc
rmdir %APPDATA%\\.wdm /s  # Windows

python run.py
```

### Lỗi: "Captcha detected"

**Nguyên nhân**: Website phát hiện bot scraping

**Giải pháp**:

1. Tắt Headless Mode (để giải captcha thủ công)
2. Hoặc upload cookie để bypass captcha

### Lỗi: "URL not found"

**Nguyên nhân**: URL video không tồn tại hoặc comment đã bị xóa

**Giải pháp**: Kiểm tra URL có đúng và video còn tồn tại không

### Lỗi: Database locked

**Giải pháp**: Đóng tất cả instance Flask đang chạy, xóa file `.db-journal`

```bash
rm instance/scraper.db-journal
```

## 📝 Log & Debug

### Bật Debug Mode

Chỉnh sửa `.env`:

```env
FLASK_DEBUG=True
```

### Xem log Selenium

Logs sẽ được in ra console khi scraping:

```
✅ Chrome WebDriver đã khởi tạo thành công!
🌐 Đang sử dụng proxy: http://10.0.0.1:8080
🚀 Bắt đầu scrape: https://www.tiktok.com/...
📊 Đã lấy 50 comments
```

## 🔐 Production Deployment

### Chuẩn bị Production

1. **Thay đổi SECRET_KEY**

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

2. **Tắt Debug Mode**

```env
FLASK_DEBUG=False
```

3. **Sử dụng Production Database**

```env
# Nếu dùng PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/web_scraper
```

4. **Sử dụng WSGI Server** (thay vì Flask dev server)

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

5. **Cấu hình HTTPS/SSL**

Khuyến nghị dùng Nginx hoặc Apache làm reverse proxy

## 📚 Tài liệu Bổ Sung

- [Flask Documentation](https://flask.palletsprojects.com/)
- [Selenium Documentation](https://www.selenium.dev/documentation/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh! Vui lòng:

1. Fork repository
2. Tạo branch cho feature (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## ⚖️ License

MIT License - Xem file LICENSE để chi tiết

## ⚠️ Lưu ý Pháp Lý

Ứng dụng này dành cho **mục đích giáo dục và nghiên cứu**.

⚠️ **Hãy tuân thủ Điều khoản sử dụng và chính sách bảo mật của TikTok/Facebook**

- Kiểm tra TOS của các platform trước khi scrape
- Không sử dụng để spam hoặc quấy rối
- Respects robots.txt và rate limits
- Có thể bị ban nếu vi phạm terms

## 💬 Hỗ Trợ

Nếu gặp vấn đề:

1. Kiểm tra phần Troubleshooting
2. Xem log chi tiết (bật FLASK_DEBUG=True)
3. Kiểm tra issue trên GitHub
4. Liên hệ: [support email hoặc contact info]

---

**Made with ❤️ by DungDev** môi trường:\*\*

| Biến                | Mô tả                                      | Mặc định                      |
| ------------------- | ------------------------------------------ | ----------------------------- |
| `SECRET_KEY`        | Secret key cho Flask session               | default-secret-key-change-me  |
| `DATABASE_URL`      | URL kết nối database                       | sqlite:///instance/scraper.db |
| `HEADLESS_MODE`     | Chạy Chrome ở chế độ headless              | True                          |
| `SCROLL_PAUSE_TIME` | Thời gian pause giữa các lần scroll (giây) | 2                             |
| `MAX_SCROLL_COUNT`  | Số lần scroll tối đa                       | 10                            |
| `FLASK_DEBUG`       | Debug mode cho Flask                       | True                          |
| `FLASK_HOST`        | Host cho Flask server                      | 0.0.0.0                       |
| `FLASK_PORT`        | Port cho Flask server                      | 5000                          |

### 5. Chạy ứng dụng

```bash
python run.py
```

Ứng dụng sẽ chạy tại: **http://localhost:5000**

## 📖 Sử dụng

### Bước 1: Đăng ký/Đăng nhập

1. Truy cập http://localhost:5000
2. Chọn "Đăng ký" hoặc "Đăng nhập"
3. Nhập thông tin tài khoản
   - Tên đăng nhập: 3-80 ký tự (chữ, số, gạch dưới)
   - Email: Email hợp lệ
   - Mật khẩu: Tối thiểu 8 ký tự

### Bước 2: Cấu hình Settings (Optional nhưng khuyến nghị)

1. Truy cập **Settings**
2. **Upload Cookie** (nếu muốn tránh captcha):
   - Lấy cookie từ TikTok/Facebook (dùng tools như EditThisCookie)
   - Export thành file JSON
   - Upload lên Settings
3. **Cấu hình Proxy** (nếu cần):
   - Nhập danh sách proxy (mỗi dòng một proxy)
   - Chọn chế độ xoay: Random hoặc Sequential
4. **Headless Mode**:
   - BẬT: Chrome ẩn, nhanh hơn
   - TẮT: Chrome hiện, có thể thấy quá trình scraping

### Bước 3: Scrape Comment

1. Quay lại **Dashboard**
2. Nhập URL video TikTok hoặc Facebook
3. Ấn **"Bắt đầu Scrape"**
4. Xem tiến độ real-time
5. Khi hoàn tất, xem chi tiết hoặc **Export Excel**

### Bước 4: Quản lý Lịch sử

- Xem tất cả lần scrape trước đó
- Xem chi tiết từng lần scrape
- Export dữ liệu ra Excel
- Theo dõi tổng comment đã cào

Ứng dụng sẽ chạy tại: http://localhost:5000

## Sử dụng

### 1. Đăng ký tài khoản

- Truy cập http://localhost:5000/auth/register
- Điền thông tin: Username, Email, Mật khẩu
- Mật khẩu tối thiểu 8 ký tự

### 2. Đăng nhập

- Truy cập http://localhost:5000/auth/login
- Đăng nhập với tài khoản đã tạo

### 3. Scrape Comment

- Tại Dashboard, nhập URL video TikTok hoặc Facebook
- Click "Bắt đầu Scrape"
- Chờ quá trình scrape hoàn tất
- Xem kết quả và xuất Excel

### Định dạng URL hỗ trợ

**TikTok:**

```
https://www.tiktok.com/@username/video/1234567890
```

**Facebook:**

```
https://www.facebook.com/watch?v=1234567890
https://fb.watch/xxxxxxx
```

## API Endpoints

| Method | Endpoint                     | Mô tả                  |
| ------ | ---------------------------- | ---------------------- |
| POST   | `/api/scrape`                | Scrape comment từ URL  |
| GET    | `/api/export/<id>`           | Xuất Excel cho history |
| DELETE | `/api/history/<id>`          | Xóa lịch sử            |
| GET    | `/api/history/<id>/comments` | Lấy danh sách comment  |
| GET    | `/api/stats`                 | Thống kê của user      |

## Bảo mật

- **Mã hóa mật khẩu**: PBKDF2 với SHA256 (600,000 iterations)
- **CSRF Protection**: Flask-WTF
- **Session Security**: HTTPOnly, SameSite cookies
- **Input Validation**: WTForms validators

## Xử lý lỗi

Ứng dụng xử lý các trường hợp lỗi sau:

- **Bot Detection**: Khi bị platform phát hiện là bot
- **URL Not Found**: Khi video/post không tồn tại
- **Network Errors**: Lỗi kết nối mạng
- **Invalid URL**: URL không hợp lệ

## Lưu ý quan trọng

1. **Scraping Ethics**: Chỉ sử dụng cho mục đích nghiên cứu và cá nhân
2. **Rate Limiting**: Không scrape quá nhiều trong thời gian ngắn
3. **Terms of Service**: Tuân thủ điều khoản của TikTok/Facebook
4. **Production**: Thay đổi SECRET_KEY và tắt DEBUG mode

## Troubleshooting

### Chrome/ChromeDriver không tìm thấy

```bash
# ChromeDriver sẽ tự động được cài đặt bởi webdriver-manager
# Nếu có lỗi, thử cài đặt lại:
pip install --upgrade webdriver-manager
```

### Bị phát hiện là bot

- Tăng `SCROLL_PAUSE_TIME` trong .env
- Giảm `MAX_SCROLL_COUNT`
- Chờ một thời gian trước khi scrape lại

### Database errors

```bash
# Xóa database và tạo lại
rm -f instance/scraper.db
python run.py
```

## Công nghệ sử dụng

- **Backend**: Flask, Flask-Login, Flask-WTF, Flask-SQLAlchemy
- **Scraping**: Selenium, webdriver-manager
- **Database**: SQLite (có thể thay bằng PostgreSQL)
- **Frontend**: Tailwind CSS, Vanilla JavaScript
- **Export**: pandas, openpyxl

## License

MIT License - Sử dụng tự do cho mục đích cá nhân và học tập.

---

**Tác giả**: Web Scraper Team  
**Phiên bản**: 1.0.0  
**Cập nhật**: Tháng 1, 2026
