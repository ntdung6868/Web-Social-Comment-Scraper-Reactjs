// ===========================================
// Enum-like String Literal Types
// ===========================================
// SQLite doesn't support native enums, so Prisma maps them as String.
// We define local string literal types to replace Prisma enum imports.

/**
 * Supported scraping platforms
 */
export type Platform = "TIKTOK" | "FACEBOOK";

/**
 * Subscription plan types
 */
export type PlanType = "FREE" | "PRO";

/**
 * Plan/subscription status
 */
export type PlanStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

/**
 * Scrape job status
 */
export type ScrapeStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

/**
 * Proxy rotation strategy
 */
export type ProxyRotation = "RANDOM" | "SEQUENTIAL";

/**
 * Cookie validation status
 */
export type CookieStatus = "UNKNOWN" | "VALID" | "INVALID" | "EXPIRED";
