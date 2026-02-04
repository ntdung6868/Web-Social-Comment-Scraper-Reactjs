#!/bin/bash
# ===========================================
# Deploy Script - Web Scraper Application
# ===========================================
# Chạy: chmod +x deploy.sh && ./deploy.sh

set -e

echo "=========================================="
echo "🚀 Web Scraper - Production Deployment"
echo "=========================================="

# Màu sắc cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker chưa được cài đặt!${NC}"
    echo "Vui lòng cài đặt Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Kiểm tra Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose chưa được cài đặt!${NC}"
    exit 1
fi

# Kiểm tra file .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  File .env không tồn tại!${NC}"
    echo "Đang tạo từ .env.production..."
    
    if [ -f ".env.production" ]; then
        cp .env.production .env
        echo -e "${YELLOW}⚠️  QUAN TRỌNG: Hãy cập nhật SECRET_KEY trong file .env!${NC}"
        echo ""
        echo "Tạo SECRET_KEY mới bằng lệnh:"
        echo "  python3 -c \"import secrets; print(secrets.token_hex(32))\""
        echo ""
        read -p "Nhấn Enter sau khi đã cập nhật .env, hoặc Ctrl+C để hủy..."
    else
        echo -e "${RED}❌ Không tìm thấy .env.production${NC}"
        exit 1
    fi
fi

# Kiểm tra SECRET_KEY
if grep -q "CHANGE_THIS_TO_A_RANDOM" .env; then
    echo -e "${RED}❌ Bạn chưa thay đổi SECRET_KEY trong .env!${NC}"
    echo ""
    echo "Tạo SECRET_KEY mới:"
    echo "  python3 -c \"import secrets; print(secrets.token_hex(32))\""
    echo ""
    exit 1
fi

# Kiểm tra FLASK_DEBUG
if grep -q "FLASK_DEBUG=True" .env; then
    echo -e "${YELLOW}⚠️  Cảnh báo: FLASK_DEBUG=True trong .env${NC}"
    echo "Đổi thành FLASK_DEBUG=False cho production!"
    read -p "Tiếp tục? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ Kiểm tra cấu hình hoàn tất${NC}"
echo ""

# Build và chạy
echo "📦 Building Docker image..."
docker compose build --no-cache

echo ""
echo "🔄 Stopping old containers..."
docker compose down 2>/dev/null || true

echo ""
echo "🚀 Starting application..."
docker compose up -d

echo ""
echo "⏳ Waiting for application to start..."
sleep 5

# Kiểm tra container đang chạy
if docker compose ps | grep -q "running"; then
    echo ""
    echo "=========================================="
    echo -e "${GREEN}✅ Deployment thành công!${NC}"
    echo "=========================================="
    echo ""
    echo "📍 Application URL: http://localhost:${FLASK_PORT:-5000}"
    echo ""
    echo "📋 Các lệnh hữu ích:"
    echo "  - Xem logs:      docker compose logs -f web"
    echo "  - Restart:       docker compose restart"
    echo "  - Dừng:          docker compose down"
    echo "  - Xem status:    docker compose ps"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Có lỗi xảy ra!${NC}"
    echo "Xem logs để debug:"
    echo "  docker compose logs web"
    exit 1
fi
