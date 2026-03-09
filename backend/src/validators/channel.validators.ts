// ===========================================
// Channel Validation Schemas
// ===========================================

import { z } from "zod";

const TIKTOK_CHANNEL_PATTERNS = [
  /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/?$/,
  /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+(\?.*)?$/,
];

export const channelCrawlSchema = z.object({
  channelUrl: z
    .string()
    .url("Invalid URL format")
    .refine(
      (url) => TIKTOK_CHANNEL_PATTERNS.some((p) => p.test(url)),
      { message: "URL must be a valid TikTok channel URL (e.g. https://www.tiktok.com/@username)" },
    ),
  minViews: z.number().int().min(0).default(0),
  maxVideos: z.number().int().min(1).max(500).default(100),
});

export type ChannelCrawlInput = z.infer<typeof channelCrawlSchema>;

export const scriptExtractionSchema = z.object({
  videoIds: z
    .array(z.string().min(1))
    .min(1, "At least one video must be selected")
    .max(20, "Maximum 20 videos per extraction"),
});

export type ScriptExtractionInput = z.infer<typeof scriptExtractionSchema>;

export const channelHistoryQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => Math.min(50, Math.max(1, parseInt(val, 10) || 10))),
});

export type ChannelHistoryQueryInput = z.infer<typeof channelHistoryQuerySchema>;
