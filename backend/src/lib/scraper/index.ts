// ===========================================
// Scraper Library Index
// ===========================================
// Factory function and re-exports

import { TikTokScraper } from "./tiktok.scraper.js";
import { FacebookScraper } from "./facebook.scraper.js";
import type { ScrapeConfig } from "./tiktok.scraper.js";

export { TikTokScraper } from "./tiktok.scraper.js";
export { FacebookScraper } from "./facebook.scraper.js";
export * from "./proxy.manager.js";
export { withRetry, isCaptchaError, isRateLimitError, isNetworkError } from "./retry.handler.js";

/**
 * Factory function to create scraper based on platform
 * (ported from Python get_scraper)
 */
export function createScraper(platform: string, config: ScrapeConfig) {
  switch (platform) {
    case "TIKTOK":
      return new TikTokScraper(config);
    case "FACEBOOK":
      return new FacebookScraper(config);
    default:
      throw new Error(`Platform không được hỗ trợ: ${platform}`);
  }
}
