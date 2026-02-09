// ===========================================
// User Controller
// ===========================================
// HTTP request handlers for user management

import type { Request, Response } from "express";
import { userService } from "../services/user.service.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { sendSuccess } from "../utils/response.js";
import type {
  UpdateProfileInput,
  UploadCookieInput,
  ToggleCookieInput,
  UpdateProxyInput,
  UpdateScraperSettingsInput,
} from "../validators/user.validators.js";

// ===========================================
// User Controller
// ===========================================

export const userController = {
  // ===========================================
  // Profile Endpoints
  // ===========================================

  /**
   * GET /users/profile
   * Get current user's profile
   */
  getProfile: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const profile = await userService.getProfile(req.user.userId);
    sendSuccess(res, { user: profile });
  }),

  /**
   * PATCH /users/profile
   * Update current user's profile
   */
  updateProfile: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const data = req.body as UpdateProfileInput;

    const profile = await userService.updateProfile(req.user.userId, data);
    sendSuccess(res, { user: profile }, "Profile updated successfully");
  }),

  // ===========================================
  // Settings Endpoints
  // ===========================================

  /**
   * GET /users/settings
   * Get current user's settings (cookies, proxy, scraper)
   */
  getSettings: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const settings = await userService.getSettings(req.user.userId);
    sendSuccess(res, { settings });
  }),

  // ===========================================
  // Cookie Endpoints
  // ===========================================

  /**
   * GET /users/cookies/:platform
   * Get cookie info for a platform
   */
  getCookieInfo: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const platform = req.params.platform as "tiktok" | "facebook";

    if (platform !== "tiktok" && platform !== "facebook") {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Platform must be tiktok or facebook" },
      });
      return;
    }

    const cookieInfo = await userService.getCookieInfo(req.user.userId, platform);
    sendSuccess(res, { cookie: cookieInfo });
  }),

  /**
   * POST /users/cookies
   * Upload cookie for a platform
   */
  uploadCookie: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const data = req.body as UploadCookieInput;
    const cookieInfo = await userService.uploadCookie(req.user.userId, data);
    sendSuccess(res, { cookie: cookieInfo }, `${data.platform} cookie uploaded successfully`);
  }),

  /**
   * PATCH /users/cookies/toggle
   * Toggle cookie usage
   */
  toggleCookie: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const data = req.body as ToggleCookieInput;
    const cookieInfo = await userService.toggleCookie(req.user.userId, data);

    const status = data.enabled ? "enabled" : "disabled";
    sendSuccess(res, { cookie: cookieInfo }, `${data.platform} cookie ${status}`);
  }),

  /**
   * DELETE /users/cookies/:platform
   * Delete cookie for a platform
   */
  deleteCookie: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const platform = req.params.platform as "tiktok" | "facebook";

    if (platform !== "tiktok" && platform !== "facebook") {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Platform must be tiktok or facebook" },
      });
      return;
    }

    await userService.deleteCookie(req.user.userId, platform);
    sendSuccess(res, null, `${platform} cookie deleted successfully`);
  }),

  // ===========================================
  // Proxy Endpoints
  // ===========================================

  /**
   * GET /users/proxies
   * Get proxy list
   */
  getProxyList: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const proxyData = await userService.getProxyList(req.user.userId);
    sendSuccess(res, proxyData);
  }),

  /**
   * PUT /users/proxies
   * Update proxy settings
   */
  updateProxies: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const data = req.body as UpdateProxyInput;
    const result = await userService.updateProxySettings(req.user.userId, data);

    sendSuccess(res, result, `${result.proxyCount} proxies saved`);
  }),

  /**
   * PATCH /users/proxies/toggle
   * Toggle proxy usage
   */
  toggleProxy: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const { enabled } = req.body as { enabled: boolean };
    const result = await userService.toggleProxy(req.user.userId, enabled);

    const status = enabled ? "enabled" : "disabled";
    sendSuccess(res, result, `Proxy ${status}`);
  }),

  /**
   * DELETE /users/proxies
   * Delete all proxies
   */
  deleteProxies: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    await userService.deleteProxies(req.user.userId);
    sendSuccess(res, null, "All proxies deleted");
  }),

  // ===========================================
  // Scraper Settings Endpoints
  // ===========================================

  /**
   * PATCH /users/settings/scraper
   * Update scraper settings
   */
  updateScraperSettings: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const { headlessMode } = req.body as UpdateScraperSettingsInput;
    const result = await userService.updateScraperSettings(req.user.userId, headlessMode);

    const status = headlessMode ? "enabled (Chrome hidden)" : "disabled (Chrome visible)";
    sendSuccess(res, result, `Headless mode ${status}`);
  }),

  // ===========================================
  // Subscription Endpoints
  // ===========================================

  /**
   * GET /users/subscription
   * Get subscription info
   */
  getSubscription: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const subscription = await userService.getSubscriptionInfo(req.user.userId);
    sendSuccess(res, { subscription });
  }),
};
