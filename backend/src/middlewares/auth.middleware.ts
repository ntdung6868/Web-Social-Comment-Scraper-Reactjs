// ===========================================
// Authentication Middleware
// ===========================================
// JWT verification and user attachment

import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database.js";
import { extractBearerToken, verifyAccessToken } from "../utils/token.js";
import { sendUnauthorized, sendForbidden } from "../utils/response.js";
import type { RequestUser } from "../types/auth.types.js";

/**
 * Middleware to verify JWT access token
 * Attaches user info to request if valid
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Extract token from header
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      sendUnauthorized(res, "Access token required", "TOKEN_INVALID");
      return;
    }

    // Verify token
    const payload = verifyAccessToken(token);

    if (!payload) {
      sendUnauthorized(res, "Invalid or expired access token", "TOKEN_EXPIRED");
      return;
    }

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        isActive: true,
        isBanned: true,
        banReason: true,
      },
    });

    if (!user) {
      sendUnauthorized(res, "User not found", "USER_NOT_FOUND");
      return;
    }

    if (!user.isActive) {
      sendForbidden(res, "Account is deactivated", "USER_INACTIVE");
      return;
    }

    if (user.isBanned) {
      sendForbidden(res, `Account is banned: ${user.banReason ?? "No reason provided"}`, "USER_BANNED");
      return;
    }

    // Attach user to request
    const requestUser: RequestUser = {
      userId: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    req.user = requestUser;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    sendUnauthorized(res, "Authentication failed", "UNAUTHORIZED");
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token present, but doesn't fail if not
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      next();
      return;
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        isActive: true,
        isBanned: true,
      },
    });

    if (user && user.isActive && !user.isBanned) {
      req.user = {
        userId: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      };
    }

    next();
  } catch {
    // Silently continue without auth
    next();
  }
}
