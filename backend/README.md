# Web Scraper Backend

Node.js/Express backend with TypeScript and Prisma ORM.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: JWT (Access + Refresh tokens)

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration (env, database, cors)
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── repositories/    # Data access layer
│   ├── middlewares/     # Express middlewares
│   ├── routes/          # Route definitions
│   ├── types/           # TypeScript interfaces
│   ├── utils/           # Utility functions
│   ├── app.ts           # Express app setup
│   └── server.ts        # Entry point
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed script
├── package.json
├── tsconfig.json
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm (recommended) or npm

### Installation

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Copy environment file:

   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your database credentials:

   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/web_scraper"
   ```

4. Generate Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Run database migrations:

   ```bash
   npm run prisma:migrate
   ```

6. (Optional) Seed the database:
   ```bash
   npm run prisma:seed
   ```

### Development

```bash
npm run dev
```

Server will start at `http://localhost:5000`

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

| Method | Endpoint                  | Description          |
| ------ | ------------------------- | -------------------- |
| GET    | `/health`                 | Health check         |
| GET    | `/api/v1`                 | API info             |
| POST   | `/api/v1/auth/login`      | User login           |
| POST   | `/api/v1/auth/register`   | User registration    |
| POST   | `/api/v1/auth/refresh`    | Refresh access token |
| POST   | `/api/v1/auth/logout`     | User logout          |
| GET    | `/api/v1/users/me`        | Get current user     |
| POST   | `/api/v1/scraper/scrape`  | Start scraping       |
| GET    | `/api/v1/scraper/history` | Get scrape history   |

## Scripts

| Script                    | Description              |
| ------------------------- | ------------------------ |
| `npm run dev`             | Start development server |
| `npm run build`           | Build for production     |
| `npm start`               | Start production server  |
| `npm run prisma:generate` | Generate Prisma client   |
| `npm run prisma:migrate`  | Run migrations           |
| `npm run prisma:studio`   | Open Prisma Studio       |
| `npm run prisma:seed`     | Seed database            |
| `npm run lint`            | Run ESLint               |
| `npm run typecheck`       | Type check without emit  |

## Environment Variables

| Variable              | Description                  | Default                 |
| --------------------- | ---------------------------- | ----------------------- |
| `NODE_ENV`            | Environment                  | `development`           |
| `PORT`                | Server port                  | `5000`                  |
| `DATABASE_URL`        | PostgreSQL connection string | Required                |
| `JWT_ACCESS_SECRET`   | Access token secret          | Required                |
| `JWT_REFRESH_SECRET`  | Refresh token secret         | Required                |
| `CORS_ORIGIN`         | Allowed CORS origin          | `http://localhost:5173` |
| `SCRAPER_SERVICE_URL` | Python scraper service URL   | `http://localhost:8000` |

## Architecture

The backend follows the **Controller-Service-Repository** pattern:

- **Controllers**: Handle HTTP requests/responses
- **Services**: Contain business logic
- **Repositories**: Handle database operations

All data models use strict TypeScript interfaces - no `any` types allowed.
