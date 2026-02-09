# 🕷️ Web Scraper — Comment Crawler

Ứng dụng full-stack tự động cào bình luận từ **TikTok** và **Facebook**, hỗ trợ Cookie/Proxy, export Excel, quản lý user qua Admin Dashboard.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

---

## ✨ Tính năng

- **Cào bình luận TikTok & Facebook** — DOM extraction + API interception (TikTok)
- **Hỗ trợ Cookie** — Đăng nhập sẵn để bypass login wall & tăng độ ổn định
- **Proxy support** — Tránh bị chặn IP
- **Realtime progress** — Socket.io cập nhật tiến độ cào theo thời gian thực
- **Export Excel** — Tải kết quả dưới dạng `.xlsx`
- **Lịch sử cào** — Lưu tất cả lần cào, xem lại & tải lại bất cứ lúc nào
- **Admin Dashboard** — Quản lý user, xem thống kê, phân quyền
- **Captcha Detection** — Phát hiện Captcha, dừng ngay & thông báo lấy cookie mới
- **Anti-detection** — Chrome flags + narrow window (500px) + webdriver cloak

## 🏗️ Kiến trúc

```
web-scraper/
├── backend/          # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/          # Env, CORS, database config
│   │   ├── controllers/     # Route handlers
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Data access (Prisma)
│   │   ├── lib/scraper/     # 🕷️ Scraper engines (Playwright)
│   │   │   ├── tiktok.scraper.ts
│   │   │   └── facebook.scraper.ts
│   │   ├── middlewares/     # Auth, rate-limit, validation
│   │   ├── routes/          # API routes
│   │   ├── types/           # TypeScript interfaces
│   │   ├── utils/           # Helpers (token, password, scraper utils)
│   │   └── validators/      # Zod schemas
│   └── prisma/              # SQLite schema + migrations
│
├── frontend/         # React 18 + Vite + MUI v5
│   └── src/
│       ├── pages/           # Views (Scraper, History, Settings, Admin)
│       ├── components/      # Shared UI components
│       ├── hooks/           # Custom hooks (useSocket, useDisclosure)
│       ├── services/        # API service layer
│       ├── stores/          # Zustand state management
│       └── api/             # Axios instance + interceptors
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, MUI v5, TanStack Query, Zustand, Socket.io-client |
| **Backend** | Node.js, Express, TypeScript (strict), Prisma ORM |
| **Database** | SQLite (file-based, zero-config) |
| **Scraping** | Playwright (Chromium), DOM extraction, API interception |
| **Auth** | JWT (Access + Refresh tokens), bcrypt |
| **Realtime** | Socket.io |

## 🚀 Cài đặt

### Yêu cầu

- **Node.js** ≥ 18
- **npm** hoặc **pnpm**

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/web-scraper.git
cd web-scraper

# Backend
cd backend
npm install
npx playwright install chromium

# Frontend
cd ../frontend
npm install
```

### 2. Cấu hình môi trường

Tạo file `backend/.env`:

```env
# Server
NODE_ENV=development
PORT=5000

# Database (SQLite)
DATABASE_URL="file:./dev.db"

# JWT — ĐỔI SANG CHUỖI NGẪU NHIÊN TRƯỚC KHI DEPLOY!
JWT_ACCESS_SECRET=your-access-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Khởi tạo Database

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
npm run prisma:seed    # Tạo tài khoản admin mặc định
```

### 4. Chạy Development

```bash
# Terminal 1 — Backend
cd backend
npm run dev            # http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm run dev            # http://localhost:5173
```

## 📖 API Overview

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| `POST` | `/api/v1/auth/register` | Đăng ký |
| `POST` | `/api/v1/auth/login` | Đăng nhập |
| `POST` | `/api/v1/auth/refresh` | Refresh token |
| `POST` | `/api/v1/scraper/start` | Bắt đầu cào |
| `POST` | `/api/v1/scraper/stop` | Dừng cào |
| `GET`  | `/api/v1/scraper/history` | Lịch sử cào |
| `GET`  | `/api/v1/scraper/export/:id` | Export Excel |
| `GET`  | `/api/v1/user/profile` | Thông tin user |
| `PUT`  | `/api/v1/user/settings` | Cập nhật cài đặt |
| `GET`  | `/api/v1/admin/users` | (Admin) Danh sách user |
| `GET`  | `/api/v1/admin/stats` | (Admin) Thống kê |

## 🕷️ Scraper Logic

### TikTok
1. Mở Chromium (500×1000px, `--headless=new`)
2. Nạp cookie → Navigate → Click mở panel bình luận
3. Burst scroll (`window.scrollBy(0, 1200)` × 15, interval 60ms)
4. Captcha? → **Dừng ngay**, thông báo lấy cookie mới
5. DOM extraction (`[data-e2e="comment-level-1"]`) + API interception (bonus)

### Facebook
1. Mở Chromium (500×1000px) → CDP resize window
2. Nạp cookie → Navigate → Chuyển filter "Tất cả bình luận"
3. Tìm scroll container (div scrollable lớn nhất trong dialog)
4. Burst scroll bên trong container (`scrollTop += step` × 15)
5. DOM extraction (`div[role="article"]`), lọc reply, lọc junk lines

## 🔒 Bảo mật

- JWT Access + Refresh token rotation
- Bcrypt password hashing (12 rounds)
- Rate limiting (Express)
- Helmet security headers
- Input validation (Zod)
- CORS configuration

## 📝 License

MIT

---

> Built with ❤️ using TypeScript, React & Playwright
