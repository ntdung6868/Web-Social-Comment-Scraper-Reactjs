// ===========================================
// Scraper Validation Schemas
// ===========================================
// Zod schemas for scraper endpoints

import { z } from "zod";

// ===========================================
// URL Validation Patterns
// ===========================================

const TIKTOK_URL_PATTERNS = [
  /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
  /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/photo\/\d+/,
  /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/,
  /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/,
];

const FACEBOOK_URL_PATTERNS = [/^https?:\/\/(www\.|m\.|web\.)?facebook\.com\//, /^https?:\/\/(www\.)?fb\.watch\//];

// ===========================================
// Scrape Request Schema
// ===========================================

export const scrapeRequestSchema = z.object({
  url: z
    .string()
    .url("Invalid URL format")
    .refine(
      (url) => {
        const isTikTok = TIKTOK_URL_PATTERNS.some((p) => p.test(url));
        const isFacebook = FACEBOOK_URL_PATTERNS.some((p) => p.test(url));
        return isTikTok || isFacebook;
      },
      {
        message: "URL must be a valid TikTok or Facebook video/post URL",
      },
    ),
  maxComments: z.number().int().min(1).max(50000).optional().default(1000),
});

export type ScrapeRequestInput = z.infer<typeof scrapeRequestSchema>;

// ===========================================
// Export Request Schema
// ===========================================

export const exportRequestSchema = z.object({
  historyId: z.number().int().positive("Invalid history ID"),
  format: z.enum(["xlsx", "csv", "json"], {
    errorMap: () => ({ message: "Format must be xlsx, csv, or json" }),
  }),
});

export type ExportRequestInput = z.infer<typeof exportRequestSchema>;

// ===========================================
// History ID Param Schema
// ===========================================

export const historyIdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Invalid history ID",
    }),
});

export type HistoryIdParamInput = z.infer<typeof historyIdParamSchema>;

// ===========================================
// History List Query Schema
// ===========================================

export const historyListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))),
  platform: z.enum(["TIKTOK", "FACEBOOK"]).optional(),
  status: z.enum(["PENDING", "RUNNING", "SUCCESS", "FAILED"]).optional(),
  sortBy: z.enum(["createdAt", "totalComments"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type HistoryListQueryInput = z.infer<typeof historyListQuerySchema>;

// ===========================================
// Helper Functions
// ===========================================

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): "TIKTOK" | "FACEBOOK" | null {
  if (TIKTOK_URL_PATTERNS.some((p) => p.test(url))) {
    return "TIKTOK";
  }
  if (FACEBOOK_URL_PATTERNS.some((p) => p.test(url))) {
    return "FACEBOOK";
  }
  return null;
}

/**
 * Validate URL for specific platform
 */
export function isValidPlatformUrl(url: string, platform: "TIKTOK" | "FACEBOOK"): boolean {
  if (platform === "TIKTOK") {
    return TIKTOK_URL_PATTERNS.some((p) => p.test(url));
  }
  return FACEBOOK_URL_PATTERNS.some((p) => p.test(url));
}
