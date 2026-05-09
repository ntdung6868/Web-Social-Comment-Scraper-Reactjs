// ===========================================
// Environment Configuration
// ===========================================
// Centralized environment variable management with type safety

import dotenv from "dotenv";
import path from "path";

// Load .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Helper function to get required env variable
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Like getEnvVar but refuses to use the default in production. Caller passes
 * a dev-only default that's safe to ship in source; in prod the env MUST be
 * set or startup throws. Use this for secrets (JWT keys, webhook tokens).
 */
function getSecretEnvVar(key: string, devDefault: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Missing required secret in production: ${key}. ` +
          `Refusing to start with the dev fallback because it would let anyone with ` +
          `access to the source code forge tokens.`,
      );
    }
    return devDefault;
  }
  return value;
}

// Helper function to get optional env variable
function getOptionalEnvVar(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

// Helper function to parse boolean env variable
function getBoolEnvVar(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

// Helper function to parse integer env variable
function getIntEnvVar(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ===========================================
// Environment Configuration Object
// ===========================================
export const env = {
  // Server
  nodeEnv: getOptionalEnvVar("NODE_ENV", "development"),
  port: getIntEnvVar("PORT", 5000),
  apiVersion: getOptionalEnvVar("API_VERSION", "v1"),
  isDevelopment: getOptionalEnvVar("NODE_ENV", "development") === "development",
  isProduction: getOptionalEnvVar("NODE_ENV", "development") === "production",

  // Database
  databaseUrl: getEnvVar("DATABASE_URL"),

  // JWT — secrets are required in production; throwing on missing prevents
  // accidentally shipping the dev fallback (which is in our source code).
  jwt: {
    accessSecret: getSecretEnvVar("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: getSecretEnvVar("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
    accessExpiresIn: getOptionalEnvVar("JWT_ACCESS_EXPIRES_IN", "15m"),
    refreshExpiresIn: getOptionalEnvVar("JWT_REFRESH_EXPIRES_IN", "7d"),
  },

  // CORS
  cors: {
    origin: getOptionalEnvVar("CORS_ORIGIN", "http://localhost:5173"),
    credentials: getBoolEnvVar("CORS_CREDENTIALS", true),
  },

  // Scraper Microservice
  scraper: {
    serviceUrl: getOptionalEnvVar("SCRAPER_SERVICE_URL", "http://localhost:8000"),
    apiKey: getOptionalEnvVar("SCRAPER_SERVICE_API_KEY", "internal-api-key"),
  },

  // Email (Resend)
  email: {
    resendApiKey: getOptionalEnvVar("RESEND_API_KEY", ""),
    mailFrom: getOptionalEnvVar("MAIL_FROM", "Crawl Comments <noreply@example.com>"),
  },

  // Rate Limiting
  rateLimit: {
    windowMs: getIntEnvVar("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000), // 15 minutes
    maxRequests: getIntEnvVar("RATE_LIMIT_MAX_REQUESTS", 500), // Increased from 100 to 500
    useRedis: getBoolEnvVar("RATE_LIMIT_USE_REDIS", true), // Use Redis by default
  },

  // Redis
  redis: {
    url: getOptionalEnvVar("REDIS_URL", "redis://localhost:6379"),
  },

  // Security
  security: {
    bcryptSaltRounds: getIntEnvVar("BCRYPT_SALT_ROUNDS", 12),
    passwordChangeCooldownDays: getIntEnvVar("PASSWORD_CHANGE_COOLDOWN_DAYS", 7),
  },

  // SePay Payment Gateway (VietQR webhook-based)
  sepay: {
    bankAcc:      getOptionalEnvVar("SEPAY_BANK_ACC",      ""),
    bankName:     getOptionalEnvVar("SEPAY_BANK_NAME",     ""),
    accountName:  getOptionalEnvVar("SEPAY_ACCOUNT_NAME",  "CHỦ TÀI KHOẢN"),
    webhookToken: getOptionalEnvVar("SEPAY_WEBHOOK_TOKEN", ""),
  },

  // Queue / Worker
  queue: {
    workerConcurrency: getIntEnvVar("WORKER_CONCURRENCY", 5), // PREMIUM lane concurrency
  },

  // Gemini AI
  gemini: {
    apiKey: getOptionalEnvVar("GEMINI_API_KEY", ""),
  },
} as const;

// Type for environment configuration
export type EnvConfig = typeof env;
