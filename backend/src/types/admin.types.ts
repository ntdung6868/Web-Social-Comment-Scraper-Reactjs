// ===========================================
// Admin Types & Interfaces
// ===========================================
// Type definitions for admin-related operations

import type { PlanType, PlanStatus, Platform, ScrapeStatus } from "./enums.js";

/**
 * System health status
 */
export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    scraper: ServiceHealth;
  };
  memory: MemoryUsage;
  cpu: CpuUsage;
}

export interface ServiceHealth {
  status: "up" | "down" | "unknown";
  latency?: number;
  error?: string;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface CpuUsage {
  percentage: number;
  loadAverage: number[];
}

/**
 * Admin dashboard statistics
 */
export interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    banned: number;
    newToday: number;
    newThisWeek: number;
  };
  subscriptions: {
    free: number;
    pro: number;
    expired: number;
  };
  scraping: {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    activeJobs: number;
    queuedJobs: number;
    totalComments: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * User list item for admin view
 */
export interface AdminUserListItem {
  id: number;
  username: string;
  email: string;
  createdAt: Date;
  isActive: boolean;
  isAdmin: boolean;
  planType: PlanType;
  planStatus: PlanStatus;
  trialUses: number;
  isBanned: boolean;
  lastLogin?: Date;
  scrapeCount: number;
}

/**
 * User detail for admin view
 */
export interface AdminUserDetail extends AdminUserListItem {
  banReason: string | null;
  bannedAt: Date | null;
  subscriptionStart: Date | null;
  subscriptionEnd: Date | null;
  lastPasswordChange: Date | null;
  lastEmailChange: Date | null;
  proxyEnabled: boolean;
  headlessMode: boolean;
  hasTiktokCookie: boolean;
  hasFacebookCookie: boolean;
}

/**
 * Admin user update payload
 */
export interface AdminUserUpdatePayload {
  isActive?: boolean;
  isAdmin?: boolean;
  planType?: PlanType;
  planStatus?: PlanStatus;
  trialUses?: number;
  subscriptionEnd?: Date | null;
}

/**
 * Ban user payload
 */
export interface BanUserPayload {
  reason: string;
}

/**
 * Scrape log for admin view
 */
export interface AdminScrapeLog {
  id: number;
  userId: number;
  username: string;
  platform: Platform;
  url: string;
  status: ScrapeStatus;
  totalComments: number;
  errorMessage: string | null;
  createdAt: Date;
  duration?: number;
}

/**
 * Admin search filters
 */
export interface AdminUserFilters {
  search?: string;
  planType?: PlanType;
  planStatus?: PlanStatus;
  isBanned?: boolean;
  isAdmin?: boolean;
  sortBy?: "createdAt" | "username" | "email" | "scrapeCount";
  sortOrder?: "asc" | "desc";
}

export interface AdminScrapeFilters {
  userId?: number;
  platform?: Platform;
  status?: ScrapeStatus;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: "createdAt" | "totalComments";
  sortOrder?: "asc" | "desc";
}

/**
 * Global settings
 */
export interface GlobalSettings {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxTrialUses: number;
  maxConcurrentScrapes: number;
  defaultProxyRotation: string;
}
