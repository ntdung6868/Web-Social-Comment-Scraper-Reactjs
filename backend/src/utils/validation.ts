// ===========================================
// URL Validation Utilities
// ===========================================
// Validate and parse TikTok/Facebook URLs

import { Platform } from "@prisma/client";
import type { UrlValidationResult } from "../types/scraper.types.js";

// TikTok URL patterns
const TIKTOK_PATTERNS = [
  // Standard video URL
  /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i,
  // Short URL
  /^https?:\/\/(vm|vt)\.tiktok\.com\/[\w]+/i,
  // Mobile URL
  /^https?:\/\/m\.tiktok\.com\/v\/\d+/i,
  // Web share URL
  /^https?:\/\/(www\.)?tiktok\.com\/t\/[\w]+/i,
];

// Facebook URL patterns
const FACEBOOK_PATTERNS = [
  // Video URL
  /^https?:\/\/(www\.|m\.|web\.)?facebook\.com\/[\w.-]+\/videos\/\d+/i,
  // Watch URL
  /^https?:\/\/(www\.|m\.)?facebook\.com\/watch\/?\?v=\d+/i,
  // Reel URL
  /^https?:\/\/(www\.|m\.)?facebook\.com\/reel\/\d+/i,
  // Post URL
  /^https?:\/\/(www\.|m\.)?facebook\.com\/[\w.-]+\/posts\/[\w.-]+/i,
  // Story URL
  /^https?:\/\/(www\.|m\.)?facebook\.com\/stories\/\d+/i,
  // Photo URL
  /^https?:\/\/(www\.|m\.)?facebook\.com\/photo(\/|\?)/i,
  // Permalink
  /^https?:\/\/(www\.|m\.)?facebook\.com\/permalink\.php\?/i,
  // Groups
  /^https?:\/\/(www\.|m\.)?facebook\.com\/groups\/[\w.-]+\/(posts|permalink)\/\d+/i,
];

/**
 * Detect platform from URL
 * @param url - URL to check
 * @returns Platform enum or null
 */
export function detectPlatform(url: string): Platform | null {
  // Check TikTok
  for (const pattern of TIKTOK_PATTERNS) {
    if (pattern.test(url)) {
      return Platform.TIKTOK;
    }
  }

  // Check Facebook
  for (const pattern of FACEBOOK_PATTERNS) {
    if (pattern.test(url)) {
      return Platform.FACEBOOK;
    }
  }

  return null;
}

/**
 * Validate URL format
 * @param url - URL to validate
 * @returns True if URL is valid format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate scraper URL (TikTok or Facebook)
 * @param url - URL to validate
 * @returns Validation result
 */
export function validateScraperUrl(url: string): UrlValidationResult {
  // Check if URL is valid format
  if (!url || typeof url !== "string") {
    return {
      isValid: false,
      platform: null,
      error: "URL is required",
    };
  }

  const trimmedUrl = url.trim();

  if (!isValidUrl(trimmedUrl)) {
    return {
      isValid: false,
      platform: null,
      error: "Invalid URL format",
    };
  }

  // Detect platform
  const platform = detectPlatform(trimmedUrl);

  if (!platform) {
    return {
      isValid: false,
      platform: null,
      error: "Unsupported platform. Only TikTok and Facebook URLs are supported.",
    };
  }

  return {
    isValid: true,
    platform,
    error: null,
  };
}

/**
 * Normalize URL (remove tracking parameters, etc.)
 * @param url - URL to normalize
 * @returns Normalized URL
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());

    // Remove common tracking parameters
    const trackingParams = ["fbclid", "utm_source", "utm_medium", "utm_campaign", "ref"];
    trackingParams.forEach((param) => {
      parsed.searchParams.delete(param);
    });

    return parsed.toString();
  } catch {
    return url.trim();
  }
}

/**
 * Extract video ID from TikTok URL
 * @param url - TikTok URL
 * @returns Video ID or null
 */
export function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1]! : null;
}

/**
 * Extract video ID from Facebook URL
 * @param url - Facebook URL
 * @returns Video ID or null
 */
export function extractFacebookVideoId(url: string): string | null {
  // Try videos/ID pattern
  let match = url.match(/\/videos\/(\d+)/);
  if (match) return match[1]!;

  // Try watch?v=ID pattern
  match = url.match(/[?&]v=(\d+)/);
  if (match) return match[1]!;

  // Try reel/ID pattern
  match = url.match(/\/reel\/(\d+)/);
  if (match) return match[1]!;

  return null;
}
