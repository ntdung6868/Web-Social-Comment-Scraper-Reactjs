// ===========================================
// Auth Controller
// ===========================================
// HTTP request handlers for authentication

import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { asyncHandler } from "../middlewares/error.middleware.js";
import { sendSuccess, sendCreated } from "../utils/response.js";
import type {
  LoginInput,
  RegisterInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "../validators/auth.validators.js";

// ===========================================
// Helper Functions
// ===========================================

/**
 * Extract request metadata (user agent, IP)
 */
function getRequestMeta(req: Request): { userAgent?: string; ipAddress?: string } {
  return {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip ?? req.socket.remoteAddress,
  };
}

// ===========================================
// Auth Controller
// ===========================================

export const authController = {
  /**
   * POST /auth/register
   * Register a new user
   */
  register: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = req.body as RegisterInput;
    const meta = getRequestMeta(req);

    const result = await authService.register(data, meta);

    // Set refresh token in HTTP-only cookie
    setRefreshTokenCookie(res, result.tokens.refreshToken);

    sendCreated(
      res,
      {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
      "Registration successful",
    );
  }),

  /**
   * POST /auth/login
   * Login user
   */
  login: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = req.body as LoginInput;
    const meta = getRequestMeta(req);

    const result = await authService.login(data, meta);

    // Set refresh token in HTTP-only cookie
    setRefreshTokenCookie(res, result.tokens.refreshToken, data.rememberMe);

    sendSuccess(
      res,
      {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
      "Login successful",
    );
  }),

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  refresh: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken ?? (req.body as RefreshTokenInput)?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Refresh token is required",
        },
      });
      return;
    }

    const meta = getRequestMeta(req);
    const result = await authService.refreshToken(refreshToken, meta);

    sendSuccess(res, {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  }),

  /**
   * POST /auth/logout
   * Logout user (revoke refresh token)
   */
  logout: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken ?? (req.body as { refreshToken?: string })?.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    // Clear refresh token cookie
    clearRefreshTokenCookie(res);

    sendSuccess(res, null, "Logged out successfully");
  }),

  /**
   * POST /auth/logout-all
   * Logout from all devices
   */
  logoutAll: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    const revokedCount = await authService.logoutAll(req.user.userId);

    // Clear current refresh token cookie
    clearRefreshTokenCookie(res);

    sendSuccess(
      res,
      {
        revokedSessions: revokedCount,
      },
      "Logged out from all devices",
    );
  }),

  /**
   * POST /auth/forgot-password
   * Request password reset email
   */
  forgotPassword: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as ForgotPasswordInput;

    await authService.forgotPassword(email);

    // Always return success to prevent email enumeration
    sendSuccess(res, null, "If this email exists, a reset link has been sent");
  }),

  /**
   * POST /auth/reset-password
   * Reset password using token
   */
  resetPassword: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = req.body as ResetPasswordInput;

    await authService.resetPassword(data);

    sendSuccess(res, null, "Password reset successful. Please login with your new password.");
  }),

  /**
   * POST /auth/change-password
   * Change password (authenticated)
   */
  changePassword: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    const data = req.body as ChangePasswordInput;

    await authService.changePassword(req.user.userId, data);

    // Clear refresh token cookie (force re-login)
    clearRefreshTokenCookie(res);

    sendSuccess(res, null, "Password changed successfully. Please login again.");
  }),

  /**
   * GET /auth/sessions
   * Get active sessions for current user
   */
  getSessions: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    const sessions = await authService.getSessions(req.user.userId);

    sendSuccess(res, { sessions });
  }),

  /**
   * GET /auth/me
   * Get current authenticated user
   */
  getCurrentUser: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    // Import service to get full user data
    const { userService } = await import("../services/user.service.js");
    const user = await userService.getProfile(req.user.userId);

    sendSuccess(res, { user });
  }),
};

// ===========================================
// Cookie Helpers
// ===========================================

const REFRESH_TOKEN_COOKIE = "refreshToken";
const COOKIE_MAX_AGE_DEFAULT = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_MAX_AGE_REMEMBER = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Set refresh token in HTTP-only cookie
 */
function setRefreshTokenCookie(res: Response, token: string, rememberMe: boolean = false): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: rememberMe ? COOKIE_MAX_AGE_REMEMBER : COOKIE_MAX_AGE_DEFAULT,
    path: "/",
  });
}

/**
 * Clear refresh token cookie
 */
function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
