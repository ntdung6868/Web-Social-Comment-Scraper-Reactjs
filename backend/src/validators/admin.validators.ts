// ===========================================
// Admin Validation Schemas
// ===========================================
// Zod schemas for admin endpoints

import { z } from "zod";

// ===========================================
// Admin User List Query Schema
// ===========================================

export const adminUserListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 20))),
  search: z.string().max(100).optional(),
  planType: z.enum(["FREE", "PRO"]).optional(),
  planStatus: z.enum(["ACTIVE", "EXPIRED"]).optional(),
  isBanned: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
  isAdmin: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
  sortBy: z.enum(["createdAt", "username", "email", "scrapeCount"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type AdminUserListQueryInput = z.infer<typeof adminUserListQuerySchema>;

// ===========================================
// Admin User Update Schema
// ===========================================

export const adminUserUpdateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(128).optional(),
  isActive: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  planType: z.enum(["FREE", "PRO"]).optional(),
  planStatus: z.enum(["ACTIVE", "EXPIRED"]).optional(),
  trialUses: z.number().int().min(0).max(100).optional(),
  subscriptionEnd: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
});

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

// ===========================================
// Ban User Schema
// ===========================================

export const banUserSchema = z.object({
  reason: z.string().min(1, "Ban reason is required").max(500, "Ban reason must be at most 500 characters"),
});

export type BanUserInput = z.infer<typeof banUserSchema>;

// ===========================================
// Admin Scrape List Query Schema
// ===========================================

export const adminScrapeListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 20))),
  userId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  platform: z.enum(["TIKTOK", "FACEBOOK"]).optional(),
  status: z.enum(["PENDING", "RUNNING", "SUCCESS", "FAILED"]).optional(),
  dateFrom: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  dateTo: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  sortBy: z.enum(["createdAt", "totalComments"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type AdminScrapeListQueryInput = z.infer<typeof adminScrapeListQuerySchema>;

// ===========================================
// Global Settings Update Schema
// ===========================================

export const globalSettingsUpdateSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(10000).nullable(),
});

export type GlobalSettingsUpdateInput = z.infer<typeof globalSettingsUpdateSchema>;

// ===========================================
// User ID Param Schema
// ===========================================

export const userIdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Invalid user ID",
    }),
});

export type UserIdParamInput = z.infer<typeof userIdParamSchema>;
