// ===========================================
// Auth Routes
// ===========================================
// Public and protected authentication routes

import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { zodValidate } from "../validators/zod.middleware.js";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validators/auth.validators.js";

const router = Router();

// ===========================================
// Public Routes (no authentication required)
// ===========================================

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", zodValidate(registerSchema), authController.register);

/**
 * POST /api/auth/login
 * Login and get access + refresh tokens
 */
router.post("/login", zodValidate(loginSchema), authController.login);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * - Can send token in body or cookie
 */
router.post("/refresh", zodValidate(refreshTokenSchema), authController.refresh);

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post("/forgot-password", zodValidate(forgotPasswordSchema), authController.forgotPassword);

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post("/reset-password", zodValidate(resetPasswordSchema), authController.resetPassword);

// ===========================================
// Protected Routes (authentication required)
// ===========================================

/**
 * POST /api/auth/logout
 * Logout and invalidate refresh token
 */
router.post("/logout", authenticate, authController.logout);

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post("/logout-all", authenticate, authController.logoutAll);

/**
 * POST /api/auth/change-password
 * Change password (requires current password)
 */
router.post("/change-password", authenticate, zodValidate(changePasswordSchema), authController.changePassword);

/**
 * GET /api/auth/sessions
 * Get all active sessions
 */
router.get("/sessions", authenticate, authController.getSessions);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get("/me", authenticate, authController.getCurrentUser);

export default router;
