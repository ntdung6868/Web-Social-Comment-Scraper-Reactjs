// ===========================================
// User Types & Interfaces
// ===========================================
// Strict TypeScript definitions for User-related data

import type { PlanType, PlanStatus, ProxyRotation } from "@prisma/client";

/**
 * User data returned to frontend (excludes sensitive fields)
 */
export interface UserPublic {
  id: number;
  username: string;
  email: string;
  createdAt: Date;
  isActive: boolean;
  isAdmin: boolean;
  planType: PlanType;
  planStatus: PlanStatus;
  trialUses: number;
  maxTrialUses: number;
  subscriptionStart: Date | null;
  subscriptionEnd: Date | null;
  isBanned: boolean;
  banReason: string | null;
}

/**
 * User data for admin view (includes more details)
 */
export interface UserAdmin extends UserPublic {
  bannedAt: Date | null;
  lastPasswordChange: Date | null;
  lastEmailChange: Date | null;
  lastPasswordResetRequest: Date | null;
  proxyEnabled: boolean;
  headlessMode: boolean;
  useTiktokCookie: boolean;
  useFacebookCookie: boolean;
}

/**
 * User settings (cookie and proxy configuration)
 */
export interface UserSettings {
  // TikTok Cookie
  tiktokCookieFile: string | null;
  hasTiktokCookie: boolean;
  useTiktokCookie: boolean;
  tiktokCookieCount: number;

  // Facebook Cookie
  facebookCookieFile: string | null;
  hasFacebookCookie: boolean;
  useFacebookCookie: boolean;
  facebookCookieCount: number;

  // Proxy
  proxyEnabled: boolean;
  proxyCount: number;
  proxyRotation: ProxyRotation;

  // Scraper
  headlessMode: boolean;
}

/**
 * User profile update payload
 */
export interface UserProfileUpdate {
  username?: string;
  email?: string;
}

/**
 * User password change payload
 */
export interface PasswordChangePayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Cookie upload payload
 */
export interface CookieUploadPayload {
  platform: "tiktok" | "facebook";
  cookieData: string;
  filename: string;
}

/**
 * Proxy settings update payload
 */
export interface ProxySettingsPayload {
  proxyList: string;
  proxyRotation: ProxyRotation;
}

/**
 * User subscription info
 */
export interface SubscriptionInfo {
  planType: PlanType;
  planStatus: PlanStatus;
  trialUses: number;
  maxTrialUses: number;
  subscriptionStart: Date | null;
  subscriptionEnd: Date | null;
  canScrape: boolean;
  message: string;
  downloadLimit: number | null;
}

/**
 * Admin user update payload
 */
export interface AdminUserUpdate {
  isActive?: boolean;
  isAdmin?: boolean;
  planType?: PlanType;
  planStatus?: PlanStatus;
  trialUses?: number;
  isBanned?: boolean;
  banReason?: string;
  subscriptionEnd?: Date | null;
}
