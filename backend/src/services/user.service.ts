// ===========================================
// User Service (DEBUG VERSION - FULL)
// ===========================================
// Business logic for user management

import { userRepository } from "../repositories/user.repository.js";
import { createError } from "../middlewares/error.middleware.js";
import { env } from "../config/env.js";
import type { User, CookieStatus } from "@prisma/client";
import type { UserPublic, UserSettings, SubscriptionInfo } from "../types/user.types.js";
import type {
  UpdateProfileInput,
  UploadCookieInput,
  ToggleCookieInput,
  UpdateProxyInput,
} from "../validators/user.validators.js";

// ===========================================
// Types
// ===========================================

interface CookieInfo {
  platform: "tiktok" | "facebook";
  hasCookie: boolean;
  filename: string | null;
  cookieCount: number;
  userAgent: string | null;
  lastValidated: Date | null;
  status: CookieStatus;
  isEnabled: boolean;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Convert User model to public-safe user data
 */
function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    planType: user.planType,
    planStatus: user.planStatus,
    trialUses: user.trialUses,
    maxTrialUses: user.maxTrialUses,
    subscriptionStart: user.subscriptionStart,
    subscriptionEnd: user.subscriptionEnd,
    isBanned: user.isBanned,
    banReason: user.banReason,
  };
}

/**
 * Parse cookie JSON and count cookies
 */
function parseCookieCount(cookieData: string | null): number {
  if (!cookieData) return 0;

  try {
    const parsed = JSON.parse(cookieData);
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
    if (typeof parsed === "object" && parsed !== null) {
      if ("cookies" in parsed && Array.isArray((parsed as any).cookies)) {
        return (parsed as any).cookies.length;
      }
      // Count object keys as cookies
      return Object.keys(parsed).length;
    }
    return 0;
  } catch {
    return 0;
  }
}

// ===========================================
// User Service Class
// ===========================================

export class UserService {
  // ===========================================
  // Profile Operations
  // ===========================================

  /**
   * Get user profile by ID
   */
  async getProfile(userId: number): Promise<UserPublic> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    return toPublicUser(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: number, data: UpdateProfileInput): Promise<UserPublic> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    // Check if username is being changed
    if (data.username && data.username !== user.username) {
      if (await userRepository.isUsernameTaken(data.username, userId)) {
        throw createError.conflict("Username is already taken", "USERNAME_TAKEN");
      }
    }

    // Check if email is being changed
    if (data.email && data.email.toLowerCase() !== user.email.toLowerCase()) {
      if (await userRepository.isEmailTaken(data.email, userId)) {
        throw createError.conflict("Email is already taken", "EMAIL_TAKEN");
      }

      // Check rate limit for email change
      if (user.lastEmailChange) {
        const daysSinceLastChange = Math.floor((Date.now() - user.lastEmailChange.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastChange < env.security.passwordChangeCooldownDays) {
          const daysRemaining = env.security.passwordChangeCooldownDays - daysSinceLastChange;
          throw createError.tooManyRequests(
            `You can only change email every ${env.security.passwordChangeCooldownDays} days. ${daysRemaining} days remaining.`,
          );
        }
      }
    }

    const updatedUser = await userRepository.updateProfile(userId, data);
    return toPublicUser(updatedUser);
  }

  // ===========================================
  // Settings Operations
  // ===========================================

  /**
   * Get user settings (cookie, proxy, scraper config)
   */
  async getSettings(userId: number): Promise<UserSettings> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    // Debug log status
    console.log(`[DEBUG SERVICE] User ${userId} Settings:`);
    console.log(`- TikTok Cookie Present: ${!!user.tiktokCookieData}`);
    console.log(`- Facebook Cookie Present: ${!!user.facebookCookieData}`);

    // Count proxies
    const proxyCount = user.proxyList ? user.proxyList.split("\n").filter((p) => p.trim()).length : 0;

    return {
      // TikTok Cookie
      tiktokCookieFile: user.tiktokCookieFile,
      hasTiktokCookie: !!user.tiktokCookieData,
      useTiktokCookie: user.useTiktokCookie,
      tiktokCookieCount: parseCookieCount(user.tiktokCookieData),

      // Facebook Cookie
      facebookCookieFile: user.facebookCookieFile,
      hasFacebookCookie: !!user.facebookCookieData,
      useFacebookCookie: user.useFacebookCookie,
      facebookCookieCount: parseCookieCount(user.facebookCookieData),

      // Proxy
      proxyEnabled: user.proxyEnabled,
      proxyCount,
      proxyRotation: user.proxyRotation,

      // Scraper
      headlessMode: user.headlessMode,
    };
  }

  // ===========================================
  // Cookie Operations
  // ===========================================

  /**
   * Get detailed cookie info for a platform
   */
  async getCookieInfo(userId: number, platform: "tiktok" | "facebook"): Promise<CookieInfo> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    if (platform === "tiktok") {
      return {
        platform: "tiktok",
        hasCookie: !!user.tiktokCookieData,
        filename: user.tiktokCookieFile,
        cookieCount: parseCookieCount(user.tiktokCookieData),
        userAgent: user.tiktokCookieUserAgent,
        lastValidated: user.tiktokCookieValidAt,
        status: user.tiktokCookieStatus,
        isEnabled: user.useTiktokCookie,
      };
    }

    return {
      platform: "facebook",
      hasCookie: !!user.facebookCookieData,
      filename: user.facebookCookieFile,
      cookieCount: parseCookieCount(user.facebookCookieData),
      userAgent: user.facebookCookieUserAgent,
      lastValidated: user.facebookCookieValidAt,
      status: user.facebookCookieStatus,
      isEnabled: user.useFacebookCookie,
    };
  }

  /**
   * Upload cookie for a platform
   */
  async uploadCookie(userId: number, data: UploadCookieInput): Promise<CookieInfo> {
    console.log(`[DEBUG SERVICE] Uploading cookie for user ${userId}, platform: ${data.platform}`);
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    // Validate and parse cookie data
    let parsedCookies: unknown;
    try {
      parsedCookies = JSON.parse(data.cookieData);
      console.log("[DEBUG SERVICE] JSON parsed successfully");
    } catch {
      console.error("[DEBUG SERVICE] Invalid JSON format");
      throw createError.badRequest("Invalid cookie JSON format");
    }

    // Validate cookie structure
    let cookieCount: number;
    if (Array.isArray(parsedCookies)) {
      cookieCount = parsedCookies.length;
    } else if (typeof parsedCookies === "object" && parsedCookies !== null) {
      if ("cookies" in parsedCookies && Array.isArray((parsedCookies as any).cookies)) {
        cookieCount = (parsedCookies as any).cookies.length;
      } else {
        cookieCount = Object.keys(parsedCookies).length;
      }
    } else {
      throw createError.badRequest("Cookie data must be an array or object");
    }

    console.log(`[DEBUG SERVICE] Cookie count: ${cookieCount}`);

    if (cookieCount === 0) {
      throw createError.badRequest("No cookies found in the provided data");
    }

    // Update cookie in database
    if (data.platform === "tiktok") {
      await userRepository.updateTiktokCookie(userId, {
        cookieData: data.cookieData,
        cookieFile: data.filename,
        userAgent: data.userAgent,
      });
      console.log("[DEBUG SERVICE] Updated TikTok cookie in DB");
    } else {
      await userRepository.updateFacebookCookie(userId, {
        cookieData: data.cookieData,
        cookieFile: data.filename,
        userAgent: data.userAgent,
      });
      console.log("[DEBUG SERVICE] Updated Facebook cookie in DB");
    }

    return this.getCookieInfo(userId, data.platform);
  }

  /**
   * Toggle cookie usage
   */
  async toggleCookie(userId: number, data: ToggleCookieInput): Promise<CookieInfo> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    // Check if cookie exists before enabling
    if (data.enabled) {
      if (data.platform === "tiktok" && !user.tiktokCookieData) {
        throw createError.badRequest("No TikTok cookie uploaded");
      }
      if (data.platform === "facebook" && !user.facebookCookieData) {
        throw createError.badRequest("No Facebook cookie uploaded");
      }
    }

    if (data.platform === "tiktok") {
      await userRepository.toggleTiktokCookie(userId, data.enabled);
    } else {
      await userRepository.toggleFacebookCookie(userId, data.enabled);
    }

    return this.getCookieInfo(userId, data.platform);
  }

  /**
   * Delete cookie for a platform
   */
  async deleteCookie(userId: number, platform: "tiktok" | "facebook"): Promise<void> {
    console.log(`[DEBUG SERVICE] Deleting ${platform} cookie for user ${userId}`);
    if (platform === "tiktok") {
      await userRepository.deleteTiktokCookie(userId);
    } else {
      await userRepository.deleteFacebookCookie(userId);
    }
  }

  /**
   * Update cookie validation status
   * Called by the scraper service after validating cookies
   */
  async updateCookieStatus(userId: number, platform: "tiktok" | "facebook", status: CookieStatus): Promise<void> {
    if (platform === "tiktok") {
      await userRepository.updateTiktokCookieStatus(userId, status);
    } else {
      await userRepository.updateFacebookCookieStatus(userId, status);
    }
  }

  // ===========================================
  // Proxy Operations
  // ===========================================

  /**
   * Update proxy settings
   */
  async updateProxySettings(
    userId: number,
    data: UpdateProxyInput,
  ): Promise<{
    proxyCount: number;
    proxyRotation: string;
    proxyEnabled: boolean;
  }> {
    await userRepository.updateProxySettings(userId, {
      proxyList: data.proxyList,
      proxyRotation: data.proxyRotation,
    });

    const proxyLines = data.proxyList.split("\n").filter((p) => p.trim());

    return {
      proxyCount: proxyLines.length,
      proxyRotation: data.proxyRotation,
      proxyEnabled: proxyLines.length > 0,
    };
  }

  /**
   * Toggle proxy usage
   */
  async toggleProxy(userId: number, enabled: boolean): Promise<{ proxyEnabled: boolean }> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    // Check if proxies exist before enabling
    if (enabled && !user.proxyList) {
      throw createError.badRequest("No proxies configured");
    }

    await userRepository.toggleProxy(userId, enabled);
    return { proxyEnabled: enabled };
  }

  /**
   * Delete all proxies
   */
  async deleteProxies(userId: number): Promise<void> {
    await userRepository.deleteProxies(userId);
  }

  /**
   * Get proxy list (for display)
   */
  async getProxyList(userId: number): Promise<{
    proxies: string[];
    rotation: string;
    enabled: boolean;
  }> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    const proxies = user.proxyList ? user.proxyList.split("\n").filter((p) => p.trim()) : [];

    return {
      proxies,
      rotation: user.proxyRotation,
      enabled: user.proxyEnabled,
    };
  }

  // ===========================================
  // Scraper Settings Operations
  // ===========================================

  /**
   * Update scraper settings
   */
  async updateScraperSettings(
    userId: number,
    headlessMode: boolean,
  ): Promise<{
    headlessMode: boolean;
  }> {
    await userRepository.updateScraperSettings(userId, headlessMode);
    return { headlessMode };
  }

  // ===========================================
  // Subscription Operations
  // ===========================================

  /**
   * Get subscription info
   */
  async getSubscriptionInfo(userId: number): Promise<SubscriptionInfo> {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    const canScrapeResult = await userRepository.canScrape(userId);
    const downloadLimit = await userRepository.getDownloadLimit(userId);

    return {
      planType: user.planType,
      planStatus: user.planStatus,
      trialUses: user.trialUses,
      maxTrialUses: user.maxTrialUses,
      subscriptionStart: user.subscriptionStart,
      subscriptionEnd: user.subscriptionEnd,
      canScrape: canScrapeResult.canScrape,
      message: canScrapeResult.message,
      downloadLimit,
    };
  }

  /**
   * Check if user can scrape
   */
  async canScrape(userId: number): Promise<{ canScrape: boolean; message: string }> {
    return userRepository.canScrape(userId);
  }

  /**
   * Use one trial scrape
   */
  async useTrialScrape(userId: number): Promise<number> {
    return userRepository.useTrialScrape(userId);
  }
}

// Export singleton instance
export const userService = new UserService();
