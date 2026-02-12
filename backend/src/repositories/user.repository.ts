// ===========================================
// User Repository
// ===========================================
// Data access layer for user management

import { prisma } from "../config/database.js";
import type { User, Prisma } from "@prisma/client";
import type { CookieStatus, ProxyRotation } from "../types/enums.js";

// ===========================================
// Types
// ===========================================

export interface CookieUpdateData {
  cookieData: string;
  cookieFile?: string;
  userAgent?: string;
}

export interface ProxyUpdateData {
  proxyList: string;
  proxyRotation: ProxyRotation;
}

// Fields to select for public user profile
export const userProfileSelect = {
  id: true,
  username: true,
  email: true,
  createdAt: true,
  isActive: true,
  isAdmin: true,
  planType: true,
  planStatus: true,
  trialUses: true,
  maxTrialUses: true,
  subscriptionStart: true,
  subscriptionEnd: true,
  isBanned: true,
  banReason: true,
} as const;

// Fields to select for user settings
export const userSettingsSelect = {
  id: true,
  // TikTok Cookie
  tiktokCookieFile: true,
  tiktokCookieUserAgent: true,
  tiktokCookieValidAt: true,
  tiktokCookieStatus: true,
  useTiktokCookie: true,
  // Facebook Cookie
  facebookCookieFile: true,
  facebookCookieUserAgent: true,
  facebookCookieValidAt: true,
  facebookCookieStatus: true,
  useFacebookCookie: true,
  // Proxy
  proxyEnabled: true,
  proxyList: true,
  proxyRotation: true,
  currentProxyIndex: true,
  // Scraper
  headlessMode: true,
} as const;

// ===========================================
// User Repository Class
// ===========================================

export class UserRepository {
  // ===========================================
  // Basic User Operations
  // ===========================================

  /**
   * Find user by ID with selected fields
   */
  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by ID with profile fields only
   */
  async findProfileById(id: number): Promise<Prisma.UserGetPayload<{
    select: typeof userProfileSelect;
  }> | null> {
    return prisma.user.findUnique({
      where: { id },
      select: userProfileSelect,
    });
  }

  /**
   * Find user by ID with settings fields
   */
  async findSettingsById(id: number): Promise<Prisma.UserGetPayload<{
    select: typeof userSettingsSelect;
  }> | null> {
    return prisma.user.findUnique({
      where: { id },
      select: userSettingsSelect,
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: number, data: { username?: string; email?: string }): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.username) {
      updateData.username = data.username;
    }

    if (data.email) {
      updateData.email = data.email.toLowerCase();
      updateData.lastEmailChange = new Date();
    }

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  /**
   * Check if username is taken by another user
   */
  async isUsernameTaken(username: string, excludeUserId?: number): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        username,
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
      select: { id: true },
    });
    return user !== null;
  }

  /**
   * Check if email is taken by another user
   */
  async isEmailTaken(email: string, excludeUserId?: number): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
      select: { id: true },
    });
    return user !== null;
  }

  // ===========================================
  // TikTok Cookie Operations
  // ===========================================

  /**
   * Update TikTok cookie data
   */
  async updateTiktokCookie(userId: number, data: CookieUpdateData): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        tiktokCookieData: data.cookieData,
        tiktokCookieFile: data.cookieFile ?? "uploaded",
        tiktokCookieUserAgent: data.userAgent,
        tiktokCookieValidAt: new Date(),
        tiktokCookieStatus: "UNKNOWN",
        useTiktokCookie: true,
      },
    });
  }

  /**
   * Update TikTok cookie status (after validation)
   */
  async updateTiktokCookieStatus(userId: number, status: CookieStatus): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        tiktokCookieStatus: status,
        tiktokCookieValidAt: new Date(),
      },
    });
  }

  /**
   * Toggle TikTok cookie usage
   */
  async toggleTiktokCookie(userId: number, enabled: boolean): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { useTiktokCookie: enabled },
    });
  }

  /**
   * Delete TikTok cookie
   */
  async deleteTiktokCookie(userId: number): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        tiktokCookieData: null,
        tiktokCookieFile: null,
        tiktokCookieUserAgent: null,
        tiktokCookieValidAt: null,
        tiktokCookieStatus: "UNKNOWN",
        useTiktokCookie: false,
      },
    });
  }

  /**
   * Get TikTok cookie data for scraping
   */
  async getTiktokCookieData(userId: number): Promise<{
    cookieData: string | null;
    userAgent: string | null;
    isEnabled: boolean;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tiktokCookieData: true,
        tiktokCookieUserAgent: true,
        useTiktokCookie: true,
      },
    });

    return {
      cookieData: user?.tiktokCookieData ?? null,
      userAgent: user?.tiktokCookieUserAgent ?? null,
      isEnabled: user?.useTiktokCookie ?? false,
    };
  }

  // ===========================================
  // Facebook Cookie Operations
  // ===========================================

  /**
   * Update Facebook cookie data
   */
  async updateFacebookCookie(userId: number, data: CookieUpdateData): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        facebookCookieData: data.cookieData,
        facebookCookieFile: data.cookieFile ?? "uploaded",
        facebookCookieUserAgent: data.userAgent,
        facebookCookieValidAt: new Date(),
        facebookCookieStatus: "UNKNOWN",
        useFacebookCookie: true,
      },
    });
  }

  /**
   * Update Facebook cookie status
   */
  async updateFacebookCookieStatus(userId: number, status: CookieStatus): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        facebookCookieStatus: status,
        facebookCookieValidAt: new Date(),
      },
    });
  }

  /**
   * Toggle Facebook cookie usage
   */
  async toggleFacebookCookie(userId: number, enabled: boolean): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { useFacebookCookie: enabled },
    });
  }

  /**
   * Delete Facebook cookie
   */
  async deleteFacebookCookie(userId: number): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        facebookCookieData: null,
        facebookCookieFile: null,
        facebookCookieUserAgent: null,
        facebookCookieValidAt: null,
        facebookCookieStatus: "UNKNOWN",
        useFacebookCookie: false,
      },
    });
  }

  // ===========================================
  // Proxy Operations
  // ===========================================

  /**
   * Update proxy settings
   */
  async updateProxySettings(userId: number, data: ProxyUpdateData): Promise<User> {
    // Count valid proxies
    const proxyCount = data.proxyList.split("\n").filter((line) => line.trim()).length;

    return prisma.user.update({
      where: { id: userId },
      data: {
        proxyList: data.proxyList,
        proxyRotation: data.proxyRotation,
        proxyEnabled: proxyCount > 0,
        currentProxyIndex: 0,
      },
    });
  }

  /**
   * Toggle proxy usage
   */
  async toggleProxy(userId: number, enabled: boolean): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { proxyEnabled: enabled },
    });
  }

  /**
   * Delete all proxies
   */
  async deleteProxies(userId: number): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        proxyList: null,
        proxyEnabled: false,
        currentProxyIndex: 0,
      },
    });
  }

  /**
   * Get next proxy for rotation
   */
  async getNextProxy(userId: number): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        proxyList: true,
        proxyEnabled: true,
        proxyRotation: true,
        currentProxyIndex: true,
      },
    });

    if (!user?.proxyEnabled || !user.proxyList) {
      return null;
    }

    const proxies = user.proxyList.split("\n").filter((p) => p.trim());
    if (proxies.length === 0) {
      return null;
    }

    let selectedProxy: string;
    let newIndex: number;

    if (user.proxyRotation === "RANDOM") {
      newIndex = Math.floor(Math.random() * proxies.length);
      selectedProxy = proxies[newIndex]!;
    } else {
      // Sequential
      newIndex = user.currentProxyIndex % proxies.length;
      selectedProxy = proxies[newIndex]!;
      newIndex = (newIndex + 1) % proxies.length;
    }

    // Update the index
    await prisma.user.update({
      where: { id: userId },
      data: { currentProxyIndex: newIndex },
    });

    return selectedProxy.trim();
  }

  // ===========================================
  // Scraper Settings Operations
  // ===========================================

  /**
   * Update scraper settings
   */
  async updateScraperSettings(userId: number, headlessMode: boolean): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { headlessMode },
    });
  }

  // ===========================================
  // Subscription Operations
  // ===========================================

  /**
   * Check if user can scrape (has trial uses or active subscription)
   */
  async canScrape(userId: number): Promise<{
    canScrape: boolean;
    message: string;
    trialUsesRemaining?: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isBanned: true,
        banReason: true,
        planType: true,
        planStatus: true,
        trialUses: true,
        subscriptionEnd: true,
      },
    });

    if (!user) {
      return { canScrape: false, message: "User not found" };
    }

    if (user.isBanned) {
      return {
        canScrape: false,
        message: `Account is banned: ${user.banReason ?? "No reason provided"}`,
      };
    }

    if (user.planType === "PERSONAL" || user.planType === "PREMIUM") {
      if (user.subscriptionEnd && user.subscriptionEnd < new Date()) {
        // Subscription expired, update status
        await prisma.user.update({
          where: { id: userId },
          data: { planStatus: "EXPIRED" },
        });
        return { canScrape: false, message: "Your subscription has expired. Please renew your plan!" };
      }
      return { canScrape: true, message: "OK" };
    }

    // Free plan
    if (user.trialUses <= 0) {
      return {
        canScrape: false,
        message: "You have used all trial scrapes. Please upgrade your plan!",
        trialUsesRemaining: 0,
      };
    }

    return {
      canScrape: true,
      message: "OK",
      trialUsesRemaining: user.trialUses,
    };
  }

  /**
   * Use one trial scrape
   */
  async useTrialScrape(userId: number): Promise<number> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        trialUses: { decrement: 1 },
      },
      select: { trialUses: true },
    });

    // Update status if no trials left
    if (user.trialUses <= 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { planStatus: "EXPIRED" },
      });
    }

    return user.trialUses;
  }

  /**
   * Get download limit based on plan (reads from global settings)
   */
  async getDownloadLimit(userId: number): Promise<number | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planType: true },
    });

    if (!user) return 0;

    // Import dynamically to avoid circular dependency
    const { getPlanMaxComments } = await import("../utils/settings.js");
    const limits = await getPlanMaxComments();
    return limits[user.planType] ?? 100;
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
