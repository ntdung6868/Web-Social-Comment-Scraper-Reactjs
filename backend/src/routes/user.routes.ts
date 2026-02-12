// ===========================================
// User Routes
// ===========================================
// Protected routes for user management

import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { zodValidate } from "../validators/zod.middleware.js";
import {
  updateProfileSchema,
  uploadCookieSchema,
  toggleCookieSchema,
  updateProxySchema,
  toggleProxySchema,
  updateScraperSettingsSchema,
} from "../validators/user.validators.js";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// ===========================================
// Profile Routes
// ===========================================

/**
 * GET /api/users/profile
 * Get current user's profile
 */
router.get("/profile", userController.getProfile);

/**
 * PATCH /api/users/profile
 * Update current user's profile
 */
router.patch("/profile", zodValidate(updateProfileSchema), userController.updateProfile);

// ===========================================
// Settings Routes
// ===========================================

/**
 * GET /api/users/settings
 * Get all user settings (cookies, proxy, scraper)
 */
router.get("/settings", userController.getSettings);

/**
 * PATCH /api/users/settings/scraper
 * Update scraper settings (headless mode)
 */
router.patch("/settings/scraper", zodValidate(updateScraperSettingsSchema), userController.updateScraperSettings);

// ===========================================
// Cookie Routes
// ===========================================

/**
 * GET /api/users/cookies/:platform
 * Get cookie info for a specific platform
 */
router.get("/cookies/:platform", userController.getCookieInfo);

/**
 * POST /api/users/cookies
 * Upload cookie for a platform
 */
router.post("/cookies", zodValidate(uploadCookieSchema), userController.uploadCookie);

/**
 * PATCH /api/users/cookies/toggle
 * Toggle cookie usage
 */
router.patch("/cookies/toggle", zodValidate(toggleCookieSchema), userController.toggleCookie);

/**
 * DELETE /api/users/cookies/:platform
 * Delete cookie for a platform
 */
router.delete("/cookies/:platform", userController.deleteCookie);

// ===========================================
// Proxy Routes
// ===========================================

/**
 * GET /api/users/proxies
 * Get proxy list
 */
router.get("/proxies", userController.getProxyList);

/**
 * PUT /api/users/proxies
 * Update proxy settings (replace all proxies)
 */
router.put("/proxies", zodValidate(updateProxySchema), userController.updateProxies);

/**
 * PATCH /api/users/proxies/toggle
 * Toggle proxy usage
 */
router.patch("/proxies/toggle", zodValidate(toggleProxySchema), userController.toggleProxy);

/**
 * DELETE /api/users/proxies
 * Delete all proxies
 */
router.delete("/proxies", userController.deleteProxies);

// ===========================================
// Subscription Routes
// ===========================================

/**
 * GET /api/users/subscription
 * Get subscription info and usage limits
 */
router.get("/subscription", userController.getSubscription);

/**
 * POST /api/users/subscription/downgrade
 * Downgrade current plan (user-initiated)
 */
router.post("/subscription/downgrade", userController.downgradePlan);

export default router;
