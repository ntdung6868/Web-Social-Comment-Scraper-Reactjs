// ===========================================
// User Controller (DEBUG VERSION - FULL)
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

    // --- DEBUG LOG START ---
    console.log("\n========== [DEBUG] UPDATE PROFILE REQUEST ==========");
    console.log("1. User ID:", req.user.userId);
    console.log("2. Content-Type:", req.headers["content-type"]);

    const bodyKeys = Object.keys(req.body);
    console.log("3. Body Keys Received:", bodyKeys);

    if (req.body.tiktokCookieData) {
      console.log("✅ Found 'tiktokCookieData' in body");
      console.log("   Type:", typeof req.body.tiktokCookieData);
      console.log("   Length:", req.body.tiktokCookieData.length);
    } else {
      console.log("❌ 'tiktokCookieData' MISSING or Empty in body");
    }
    console.log("====================================================\n");
    // --- DEBUG LOG END ---

    const data = req.body as UpdateProfileInput;

    try {
      const profile = await userService.updateProfile(req.user.userId, data);
      sendSuccess(res, { user: profile }, "Profile updated successfully");
    } catch (error) {
      console.error("🔥 [DEBUG] Error in userService.updateProfile:", error);
      throw error;
    }
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
    console.log(`[DEBUG] Settings retrieved for user ${req.user.userId}`);
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
    console.log("\n========== [DEBUG] UPLOAD COOKIE REQUEST ==========");
    if (!req.user) {
      console.log("❌ Unauthorized request");
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    console.log(`1. User ID: ${req.user.userId}`);
    console.log(`2. Request Body Keys:`, Object.keys(req.body));
    console.log(`3. Platform: ${req.body.platform}`);
    console.log(`4. Filename: ${req.body.filename}`);

    if (req.body.cookieData) {
      console.log(`5. CookieData Type: ${typeof req.body.cookieData}`);
      console.log(`5. CookieData Length: ${req.body.cookieData.length}`);
    } else {
      console.log("❌ CookieData is MISSING or NULL");
    }

    if (typeof req.body.cookieData !== "string") {
      console.error("❌ CookieData is NOT a string. Received:", typeof req.body.cookieData);
    }

    const data = req.body as UploadCookieInput;

    try {
      const cookieInfo = await userService.uploadCookie(req.user.userId, data);
      console.log("✅ Cookie upload successful:", cookieInfo);
      sendSuccess(res, { cookie: cookieInfo }, `${data.platform} cookie uploaded successfully`);
    } catch (e) {
      console.error("🔥 Error in userService.uploadCookie:", e);
      throw e;
    }
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
    console.log("[DEBUG] Delete Cookie Request");
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

    console.log(`Deleting cookie for ${platform} - User ${req.user.userId}`);
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
