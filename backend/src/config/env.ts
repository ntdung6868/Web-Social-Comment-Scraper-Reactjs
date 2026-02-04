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

  // JWT
  jwt: {
    accessSecret: getEnvVar("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: getEnvVar("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
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
    maxRequests: getIntEnvVar("RATE_LIMIT_MAX_REQUESTS", 100),
  },

  // Security
  security: {
    bcryptSaltRounds: getIntEnvVar("BCRYPT_SALT_ROUNDS", 12),
    passwordChangeCooldownDays: getIntEnvVar("PASSWORD_CHANGE_COOLDOWN_DAYS", 7),
  },
} as const;

// Type for environment configuration
export type EnvConfig = typeof env;
