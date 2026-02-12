// ===========================================
// Maintenance Mode Middleware
// ===========================================
// Blocks non-admin users when maintenance mode is enabled

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";

// Cache to avoid hitting DB on every request
let maintenanceCache: { enabled: boolean; checkedAt: number } = {
  enabled: false,
  checkedAt: 0,
};

const CACHE_TTL = 10_000; // 10 seconds

/**
 * Check maintenance mode from DB with caching
 */
async function isMaintenanceEnabled(): Promise<boolean> {
  const now = Date.now();
  if (now - maintenanceCache.checkedAt < CACHE_TTL) {
    return maintenanceCache.enabled;
  }

  try {
    const setting = await prisma.globalSettings.findUnique({
      where: { key: "maintenanceMode" },
    });
    const enabled = setting?.value === "true";
    maintenanceCache = { enabled, checkedAt: now };
    return enabled;
  } catch {
    // If DB query fails, use cached value
    return maintenanceCache.enabled;
  }
}

/**
 * Invalidate the maintenance cache (call after settings change)
 */
export function invalidateMaintenanceCache(): void {
  maintenanceCache.checkedAt = 0;
}

/**
 * Middleware that blocks all non-admin requests when maintenance mode is on.
 * Must be placed AFTER body parsing but BEFORE route handlers.
 * Admin routes are excluded so admins can still manage the system.
 */
export async function maintenanceGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Always allow health check
  if (req.path === "/health") {
    next();
    return;
  }

  // Always allow admin routes (admins need to disable maintenance mode)
  if (req.path.includes("/admin")) {
    next();
    return;
  }

  // Always allow auth login route (so admins can log in; non-admin blocked in handler)
  if (req.path.includes("/auth/login")) {
    next();
    return;
  }

  const maintenance = await isMaintenanceEnabled();

  if (!maintenance) {
    next();
    return;
  }

  // Maintenance is ON — block the request
  res.status(503).json({
    success: false,
    error: {
      code: "MAINTENANCE_MODE",
      message: "The system is currently under maintenance. Please try again later.",
    },
  });
}
