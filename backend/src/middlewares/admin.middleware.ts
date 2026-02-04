// ===========================================
// Admin Middleware
// ===========================================
// Admin-only access verification

import type { Request, Response, NextFunction } from "express";
import { sendForbidden, sendUnauthorized } from "../utils/response.js";

/**
 * Middleware to check if user is admin
 * Must be used AFTER authenticate middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Check if user is authenticated
  if (!req.user) {
    sendUnauthorized(res, "Authentication required", "UNAUTHORIZED");
    return;
  }

  // Check if user is admin
  if (!req.user.isAdmin) {
    sendForbidden(res, "Admin access required", "FORBIDDEN");
    return;
  }

  next();
}

/**
 * Middleware to check if user owns the resource or is admin
 * @param getUserIdFromRequest - Function to extract resource owner ID from request
 */
export function requireOwnerOrAdmin(getUserIdFromRequest: (req: Request) => number | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, "Authentication required", "UNAUTHORIZED");
      return;
    }

    const resourceOwnerId = getUserIdFromRequest(req);

    // Allow if admin or resource owner
    if (req.user.isAdmin || req.user.userId === resourceOwnerId) {
      next();
      return;
    }

    sendForbidden(res, "Access denied", "FORBIDDEN");
  };
}
