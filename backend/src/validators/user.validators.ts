// ===========================================
// User Validation Schemas
// ===========================================
// Zod schemas for user endpoints

import { z } from "zod";

// ===========================================
// Update Profile Schema
// ===========================================

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(80, "Username must be at most 80 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .optional(),
  email: z
    .string()
    .email("Invalid email format")
    .max(120, "Email must be at most 120 characters")
    .toLowerCase()
    .trim()
    .optional(),

  // --- CÁC TRƯỜNG MỚI THÊM ĐỂ UPDATE COOKIE ---
  tiktokCookieData: z.any().optional(), // Dùng any() để chấp nhận array hoặc null (khi xóa)
  tiktokCookieStatus: z.string().optional(),
  facebookCookieData: z.any().optional(),
  facebookCookieStatus: z.string().optional(),
  // --------------------------------------------
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ===========================================
// Cookie Upload Schema
// ===========================================

export const uploadCookieSchema = z.object({
  platform: z.enum(["tiktok", "facebook"], {
    errorMap: () => ({ message: "Platform must be tiktok or facebook" }),
  }),
  cookieData: z
    .string()
    .min(1, "Cookie data is required")
    .refine(
      (data) => {
        try {
          const parsed = JSON.parse(data);
          // Accept array of cookies or object with cookies property
          return Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null);
        } catch {
          return false;
        }
      },
      { message: "Cookie data must be valid JSON" },
    ),
  filename: z.string().max(255).optional(),
  userAgent: z.string().max(500).optional(),
});

export type UploadCookieInput = z.infer<typeof uploadCookieSchema>;

// ===========================================
// Toggle Cookie Schema
// ===========================================

export const toggleCookieSchema = z.object({
  platform: z.enum(["tiktok", "facebook"], {
    errorMap: () => ({ message: "Platform must be tiktok or facebook" }),
  }),
  enabled: z.boolean(),
});

export type ToggleCookieInput = z.infer<typeof toggleCookieSchema>;

// ===========================================
// Proxy Settings Schema
// ===========================================

export const updateProxySchema = z.object({
  proxyList: z
    .string()
    .transform((val) => val.trim())
    .refine(
      (val) => {
        if (!val) return true;
        const lines = val.split("\n").filter((l) => l.trim());
        return lines.every((line) => {
          const trimmed = line.trim();
          // Accept various proxy formats
          return (
            trimmed.startsWith("http://") ||
            trimmed.startsWith("https://") ||
            trimmed.startsWith("socks4://") ||
            trimmed.startsWith("socks5://") ||
            /^[\w.-]+:\d+/.test(trimmed) // ip:port format
          );
        });
      },
      { message: "Invalid proxy format. Use http://ip:port or ip:port format" },
    ),
  proxyRotation: z.enum(["RANDOM", "SEQUENTIAL"]).optional().default("RANDOM"),
});

export type UpdateProxyInput = z.infer<typeof updateProxySchema>;

// ===========================================
// Toggle Proxy Schema
// ===========================================

export const toggleProxySchema = z.object({
  enabled: z.boolean(),
});

export type ToggleProxyInput = z.infer<typeof toggleProxySchema>;

// ===========================================
// Scraper Settings Schema
// ===========================================

export const updateScraperSettingsSchema = z.object({
  headlessMode: z.boolean(),
});

export type UpdateScraperSettingsInput = z.infer<typeof updateScraperSettingsSchema>;

// ===========================================
// Pagination Schema
// ===========================================

export const paginationSchema = z.object({
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
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ===========================================
// ID Parameter Schema
// ===========================================

export const idParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "Invalid ID",
    }),
});

export type IdParamInput = z.infer<typeof idParamSchema>;
