// ===========================================
// Scraper Library Index
// ===========================================

import { Platform } from "@prisma/client";
import { TikTokScraper } from "./tiktok.scraper.js";
import { FacebookScraper } from "./facebook.scraper.js";
import { ScrapeConfig } from "../../types/scraper.types.js"; // Đảm bảo type này khớp

export * from "./proxy.manager.js";
export * from "./retry.handler.js";

export function createScraper(platform: Platform, config: any) {
  switch (platform) {
    case "TIKTOK":
      return new TikTokScraper(config);
    case "FACEBOOK":
      return new FacebookScraper(config);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Hàm retry wrapper (giữ nguyên logic cũ của bạn)
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number; shouldRetry: (err: any) => boolean }
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt > options.maxRetries || !options.shouldRetry(error)) {
        throw error;
      }
      const delay = options.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
