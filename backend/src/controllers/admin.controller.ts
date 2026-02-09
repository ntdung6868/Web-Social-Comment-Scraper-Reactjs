// ===========================================
// Admin Controller
// ===========================================
// HTTP request handlers for admin endpoints

import type { Request, Response } from "express";
import { adminService } from "../services/admin.service.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { sendSuccess, sendNoContent } from "../utils/response.js";
import type {
  AdminUserListQueryInput,
  AdminUserUpdateInput,
  BanUserInput,
  AdminScrapeListQueryInput,
  GlobalSettingsUpdateInput,
} from "../validators/admin.validators.js";

// ===========================================
// Admin Controller
// ===========================================

export const adminController = {
  // ===========================================
  // System Health & Monitoring
  // ===========================================

  /**
   * GET /admin/health
   * Get system health status
   */
  getSystemHealth: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const health = await adminService.getSystemHealth();
    sendSuccess(res, health);
  }),

  /**
   * GET /admin/dashboard
   * Get admin dashboard statistics
   */
  getDashboard: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await adminService.getDashboardStats();
    sendSuccess(res, stats);
  }),

  /**
   * GET /admin/realtime
   * Get real-time statistics
   */
  getRealTimeStats: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await adminService.getRealTimeStats();
    sendSuccess(res, stats);
  }),

  // ===========================================
  // User Management
  // ===========================================

  /**
   * GET /admin/users
   * Get paginated list of users
   */
  getUserList: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminUserListQueryInput;
    const users = await adminService.getUserList(query);
    sendSuccess(res, users);
  }),

  /**
   * GET /admin/users/:id
   * Get user detail
   */
  getUserDetail: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id!, 10);
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid user ID" },
      });
      return;
    }

    const user = await adminService.getUserDetail(userId);
    sendSuccess(res, { user });
  }),

  /**
   * PATCH /admin/users/:id
   * Update user
   */
  updateUser: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id!, 10);
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid user ID" },
      });
      return;
    }

    const data = req.body as AdminUserUpdateInput;
    const user = await adminService.updateUser(userId, data);

    sendSuccess(res, { user }, "User updated successfully");
  }),

  /**
   * POST /admin/users/:id/ban
   * Ban a user
   */
  banUser: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const userId = parseInt(req.params.id!, 10);
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid user ID" },
      });
      return;
    }

    const data = req.body as BanUserInput;
    const user = await adminService.banUser(userId, data, req.user.userId);

    sendSuccess(res, { user }, "User banned successfully");
  }),

  /**
   * POST /admin/users/:id/unban
   * Unban a user
   */
  unbanUser: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id!, 10);
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid user ID" },
      });
      return;
    }

    const user = await adminService.unbanUser(userId);
    sendSuccess(res, { user }, "User unbanned successfully");
  }),

  /**
   * DELETE /admin/users/:id
   * Delete a user
   */
  deleteUser: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const userId = parseInt(req.params.id!, 10);
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid user ID" },
      });
      return;
    }

    await adminService.deleteUser(userId, req.user.userId);
    sendNoContent(res);
  }),

  /**
   * POST /admin/users/:id/reset-trial
   * Reset user trial uses
   */
  resetTrialUses: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id!, 10);
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid user ID" },
      });
      return;
    }

    const { trialCount } = req.body as { trialCount?: number };
    const user = await adminService.resetTrialUses(userId, trialCount);

    sendSuccess(res, { user }, "Trial uses reset successfully");
  }),

  /**
   * POST /admin/users/:id/grant-pro
   * Grant Pro subscription
   */
  grantProSubscription: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id!, 10);
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Invalid user ID" },
      });
      return;
    }

    const { durationDays } = req.body as { durationDays: number };
    if (!durationDays || durationDays < 1) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Duration days must be at least 1" },
      });
      return;
    }

    const user = await adminService.grantProSubscription(userId, durationDays);
    sendSuccess(res, { user }, `Pro subscription granted for ${durationDays} days`);
  }),

  // ===========================================
  // Scrape Log Management
  // ===========================================

  /**
   * GET /admin/scrapes
   * Get paginated scrape logs
   */
  getScrapeLogList: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminScrapeListQueryInput;
    const logs = await adminService.getScrapeLogList(query);
    sendSuccess(res, logs);
  }),

  // ===========================================
  // Global Settings
  // ===========================================

  /**
   * GET /admin/settings
   * Get all global settings
   */
  getSettings: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const settings = await adminService.getAllSettings();
    sendSuccess(res, { settings });
  }),

  /**
   * PATCH /admin/settings
   * Update a global setting
   */
  updateSetting: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const { key, value } = req.body as GlobalSettingsUpdateInput;
    await adminService.updateSetting(key, value, req.user.userId);

    sendSuccess(res, null, `Setting "${key}" updated`);
  }),

  /**
   * POST /admin/maintenance
   * Toggle maintenance mode
   */
  toggleMaintenance: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const { enabled } = req.body as { enabled: boolean };
    await adminService.toggleMaintenanceMode(enabled, req.user.userId);

    const status = enabled ? "enabled" : "disabled";
    sendSuccess(res, { maintenanceMode: enabled }, `Maintenance mode ${status}`);
  }),
};
