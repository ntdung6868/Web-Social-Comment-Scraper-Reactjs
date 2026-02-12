// ===========================================
// Admin Routes
// ===========================================
// Admin-only routes for system management

import { Router } from "express";
import { adminController } from "../controllers/admin.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import { zodValidate } from "../validators/zod.middleware.js";
import {
  adminUserListQuerySchema,
  adminUserUpdateSchema,
  banUserSchema,
  adminScrapeListQuerySchema,
  globalSettingsUpdateSchema,
} from "../validators/admin.validators.js";

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// ===========================================
// System Health & Monitoring
// ===========================================

/**
 * GET /api/admin/health
 * Get system health status
 */
router.get("/health", adminController.getSystemHealth);

/**
 * GET /api/admin/dashboard
 * Get admin dashboard statistics
 */
router.get("/dashboard", adminController.getDashboard);

/**
 * GET /api/admin/realtime
 * Get real-time statistics
 */
router.get("/realtime", adminController.getRealTimeStats);

// ===========================================
// User Management
// ===========================================

/**
 * GET /api/admin/users
 * Get paginated list of users
 */
router.get("/users", zodValidate(adminUserListQuerySchema, "query"), adminController.getUserList);

/**
 * GET /api/admin/users/:id
 * Get user detail
 */
router.get("/users/:id", adminController.getUserDetail);

/**
 * PATCH /api/admin/users/:id
 * Update user
 */
router.patch("/users/:id", zodValidate(adminUserUpdateSchema), adminController.updateUser);

/**
 * DELETE /api/admin/users/:id
 * Delete a user
 */
router.delete("/users/:id", adminController.deleteUser);

/**
 * POST /api/admin/users/:id/ban
 * Ban a user
 */
router.post("/users/:id/ban", zodValidate(banUserSchema), adminController.banUser);

/**
 * POST /api/admin/users/:id/unban
 * Unban a user
 */
router.post("/users/:id/unban", adminController.unbanUser);

/**
 * POST /api/admin/users/:id/reset-trial
 * Reset user trial uses
 */
router.post("/users/:id/reset-trial", adminController.resetTrialUses);

/**
 * POST /api/admin/users/:id/grant-pro
 * Grant Pro subscription to user
 */
router.post("/users/:id/grant-pro", adminController.grantProSubscription);

// ===========================================
// Scrape Log Management
// ===========================================

/**
 * GET /api/admin/scrapes
 * Get paginated scrape logs
 */
router.get("/scrapes", zodValidate(adminScrapeListQuerySchema, "query"), adminController.getScrapeLogList);

// ===========================================
// Global Settings
// ===========================================

/**
 * GET /api/admin/settings
 * Get all global settings
 */
router.get("/settings", adminController.getSettings);

/**
 * PATCH /api/admin/settings
 * Update a global setting
 */
router.patch("/settings", zodValidate(globalSettingsUpdateSchema), adminController.updateSetting);

/**
 * POST /api/admin/maintenance
 * Toggle maintenance mode
 */
router.post("/maintenance", adminController.toggleMaintenance);

// ===========================================
// Session Management
// ===========================================

/**
 * GET /api/admin/sessions
 * Get all active sessions
 */
router.get("/sessions", adminController.getActiveSessions);

/**
 * DELETE /api/admin/sessions/:id
 * Revoke a specific session
 */
router.delete("/sessions/:id", adminController.revokeSession);

/**
 * DELETE /api/admin/users/:id/sessions
 * Revoke all sessions for a user
 */
router.delete("/users/:id/sessions", adminController.revokeAllUserSessions);

/**
 * GET /api/admin/users/:id/scrapes
 * Get user scrape history
 */
router.get("/users/:id/scrapes", adminController.getUserScrapeHistory);

export default router;
