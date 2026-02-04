# ===========================================
# Dockerfile - Web Scraper Application
# ===========================================
# Image với Chrome và ChromeDriver đã cài sẵn cho Selenium

FROM python:3.11-slim-bookworm

# Metadata
LABEL maintainer="Web Scraper Team"
LABEL description="Web Scraper Application with Chrome & Selenium"

# Tránh các prompt tương tác trong quá trình build
ENV DEBIAN_FRONTEND=noninteractive

# Biến môi trường Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# CRITICAL: Tăng shared memory cho Chrome (tránh tab crash)
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null

# Thư mục làm việc
WORKDIR /app

# Cài đặt dependencies hệ thống và Google Chrome
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Dependencies cho Chrome
    wget \
    gnupg \
    ca-certificates \
    curl \
    unzip \
    # DBus for Chrome stability
    dbus \
    dbus-x11 \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    # Fonts cho các ngôn ngữ (Vietnamese, Chinese, Japanese)
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt Google Chrome Stable
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Kiểm tra Chrome version và cài ChromeDriver phù hợp
RUN CHROME_VERSION=$(google-chrome --version | grep -oP '\d+\.\d+\.\d+' | head -1) && \
    echo "Chrome version: $CHROME_VERSION" && \
    CHROME_MAJOR=$(echo $CHROME_VERSION | cut -d. -f1) && \
    echo "Chrome major version: $CHROME_MAJOR" && \
    # Tải ChromeDriver từ Chrome for Testing
    CHROMEDRIVER_URL="https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}.0/linux64/chromedriver-linux64.zip" && \
    echo "Downloading ChromeDriver from: $CHROMEDRIVER_URL" && \
    wget -q -O /tmp/chromedriver.zip "$CHROMEDRIVER_URL" && \
    unzip /tmp/chromedriver.zip -d /tmp/ && \
    mv /tmp/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver && \
    chmod +x /usr/local/bin/chromedriver && \
    rm -rf /tmp/chromedriver* && \
    chromedriver --version

# Tạo user non-root để bảo mật với home directory
RUN groupadd -r scraper && useradd -r -g scraper -m -d /home/scraper scraper

# Copy requirements trước để tận dụng Docker cache
COPY requirements.txt .

# Cài đặt Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Cài đặt gunicorn cho production server
RUN pip install --no-cache-dir gunicorn==21.2.0

# Copy source code
COPY . .

# Tạo thư mục instance và home cho scraper user
RUN mkdir -p instance && \
    mkdir -p /home/scraper/.cache && \
    mkdir -p /home/scraper/.local && \
    chown -R scraper:scraper /app && \
    chown -R scraper:scraper /home/scraper

# Chuyển sang user non-root
USER scraper

# Expose port
EXPOSE 5000

# Chạy ứng dụng với Gunicorn
# Railway sẽ inject PORT environment variable
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 4 --timeout 120 run:app"]
