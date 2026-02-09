// ===========================================
// Auth Repository
// ===========================================
// Data access layer for authentication

import crypto from "crypto";
import { prisma } from "../config/database.js";
import type { User, RefreshToken } from "@prisma/client";

// ===========================================
// Types
// ===========================================

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
}

export interface RefreshTokenData {
  userId: number;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

// Fields to select for public user data (excludes sensitive info)
export const userPublicSelect = {
  id: true,
  username: true,
  email: true,
  createdAt: true,
  isActive: true,
  isAdmin: true,
  planType: true,
  planStatus: true,
  trialUses: true,
  maxTrialUses: true,
  subscriptionStart: true,
  subscriptionEnd: true,
  isBanned: true,
  banReason: true,
} as const;

// ===========================================
// Utility Functions
// ===========================================

/**
 * Hash a refresh token using SHA-256
 * We store only the hash in the database for security
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

// ===========================================
// Auth Repository Class
// ===========================================

export class AuthRepository {
  // ===========================================
  // User Operations
  // ===========================================

  /**
   * Find user by ID
   */
  async findUserById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by username
   */
  async findUserByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by username or email (for login)
   */
  async findUserByUsernameOrEmail(identifier: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
      },
    });
  }

  /**
   * Find user by reset token
   */
  async findUserByResetToken(token: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { resetToken: token },
    });
  }

  /**
   * Create new user
   */
  async createUser(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data: {
        username: data.username,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
      },
    });
  }

  /**
   * Update user password
   */
  async updatePassword(userId: number, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        lastPasswordChange: new Date(),
        // Clear reset token if exists
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }

  /**
   * Set password reset token
   */
  async setResetToken(userId: number, token: string, expiresAt: Date): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: token,
        resetTokenExpiry: expiresAt,
        lastPasswordResetRequest: new Date(),
      },
    });
  }

  /**
   * Clear password reset token
   */
  async clearResetToken(userId: number): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    return user !== null;
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return user !== null;
  }

  // ===========================================
  // Refresh Token Operations
  // ===========================================

  /**
   * Create refresh token (stores hashed token)
   * Returns the plain token to send to client
   */
  async createRefreshToken(data: RefreshTokenData): Promise<{
    token: string;
    record: RefreshToken;
  }> {
    const plainToken = generateSecureToken();
    const tokenHash = hashToken(plainToken);

    const record = await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        deviceInfo: data.deviceInfo,
      },
    });

    return { token: plainToken, record };
  }

  /**
   * Find refresh token by plain token
   * Hashes the token and looks up by hash
   */
  async findRefreshToken(plainToken: string): Promise<RefreshToken | null> {
    const tokenHash = hashToken(plainToken);
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  /**
   * Find refresh token with user data
   */
  async findRefreshTokenWithUser(plainToken: string): Promise<(RefreshToken & { user: User }) | null> {
    const tokenHash = hashToken(plainToken);
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(tokenHash: string): Promise<RefreshToken> {
    return prisma.refreshToken.update({
      where: { tokenHash },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke refresh token by plain token
   */
  async revokeRefreshTokenByPlain(plainToken: string): Promise<RefreshToken | null> {
    const tokenHash = hashToken(plainToken);
    try {
      return await prisma.refreshToken.update({
        where: { tokenHash },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });
    } catch {
      return null;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: number): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Delete expired refresh tokens (cleanup job)
   */
  async deleteExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    return result.count;
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: number): Promise<RefreshToken[]> {
    return prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Count active sessions for a user
   */
  async countUserSessions(userId: number): Promise<number> {
    return prisma.refreshToken.count({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });
  }
}

// Export singleton instance
export const authRepository = new AuthRepository();
