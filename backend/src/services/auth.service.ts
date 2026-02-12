// ===========================================
// Auth Service
// ===========================================
// Business logic for authentication

import { authRepository } from "../repositories/auth.repository.js";
import { hashPassword, comparePassword, validatePasswordStrength } from "../utils/password.js";
import { generateAccessToken, generateResetToken, getRefreshTokenExpiry } from "../utils/token.js";
import { createError } from "../middlewares/error.middleware.js";
import { env } from "../config/env.js";
import type { User } from "@prisma/client";
import type { TokenPair, AuthResponse } from "../types/auth.types.js";
import type { UserPublic } from "../types/user.types.js";
import type { PlanType, PlanStatus } from "../types/enums.js";
import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "../validators/auth.validators.js";

// ===========================================
// Types
// ===========================================

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Convert User model to public-safe user data
 */
function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    planType: user.planType as PlanType,
    planStatus: user.planStatus as PlanStatus,
    trialUses: user.trialUses,
    maxTrialUses: user.maxTrialUses,
    subscriptionStart: user.subscriptionStart,
    subscriptionEnd: user.subscriptionEnd,
    isBanned: user.isBanned,
    banReason: user.banReason,
  };
}

/**
 * Parse user-agent to get device info
 */
function parseDeviceInfo(userAgent?: string): string {
  if (!userAgent) return "Unknown device";

  // Simple parsing for common browsers/devices
  if (userAgent.includes("Chrome")) {
    if (userAgent.includes("Windows")) return "Chrome on Windows";
    if (userAgent.includes("Mac")) return "Chrome on macOS";
    if (userAgent.includes("Linux")) return "Chrome on Linux";
    if (userAgent.includes("Android")) return "Chrome on Android";
    return "Chrome";
  }
  if (userAgent.includes("Firefox")) {
    if (userAgent.includes("Windows")) return "Firefox on Windows";
    if (userAgent.includes("Mac")) return "Firefox on macOS";
    return "Firefox";
  }
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    if (userAgent.includes("iPhone")) return "Safari on iPhone";
    if (userAgent.includes("iPad")) return "Safari on iPad";
    if (userAgent.includes("Mac")) return "Safari on macOS";
    return "Safari";
  }
  if (userAgent.includes("Edge")) return "Edge";

  return "Unknown browser";
}

// ===========================================
// Auth Service Class
// ===========================================

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterInput, meta?: RequestMeta): Promise<AuthResponse> {
    // Check if username exists
    if (await authRepository.usernameExists(data.username)) {
      throw createError.conflict("Username is already taken", "USERNAME_TAKEN");
    }

    // Check if email exists
    if (await authRepository.emailExists(data.email)) {
      throw createError.conflict("Email is already registered", "EMAIL_TAKEN");
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.isValid) {
      throw createError.badRequest(passwordValidation.errors[0] ?? "Invalid password", "INVALID_PASSWORD");
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const user = await authRepository.createUser({
      username: data.username,
      email: data.email,
      passwordHash,
    });

    // Generate tokens
    const tokens = await this.generateTokens(user, meta);

    return {
      user: toPublicUser(user),
      tokens,
    };
  }

  /**
   * Login user
   */
  async login(data: LoginInput, meta?: RequestMeta): Promise<AuthResponse> {
    // Find user by username or email
    const user = await authRepository.findUserByUsernameOrEmail(data.username);

    if (!user) {
      throw createError.unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
    }

    // Check if user is banned (before password check so banned users always see ban notice)
    if (user.isBanned) {
      throw createError.forbidden(`Account is banned: ${user.banReason ?? "No reason provided"}`, "USER_BANNED");
    }

    // Check if user is active
    if (!user.isActive) {
      throw createError.forbidden("Account is deactivated", "USER_INACTIVE");
    }

    // Check password
    const isValidPassword = await comparePassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw createError.unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
    }

    // Generate tokens
    const tokens = await this.generateTokens(user, meta);

    return {
      user: toPublicUser(user),
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, _meta?: RequestMeta): Promise<{ accessToken: string; expiresIn: number }> {
    // Find token in database
    const tokenRecord = await authRepository.findRefreshTokenWithUser(refreshToken);

    if (!tokenRecord) {
      throw createError.unauthorized("Invalid refresh token", "TOKEN_INVALID");
    }

    // Check if token is revoked
    if (tokenRecord.isRevoked) {
      // Potential token reuse attack - revoke all user tokens
      await authRepository.revokeAllUserTokens(tokenRecord.userId);
      throw createError.unauthorized("Token has been revoked", "TOKEN_REVOKED");
    }

    // Check if token is expired
    if (tokenRecord.expiresAt < new Date()) {
      throw createError.unauthorized("Refresh token expired", "TOKEN_EXPIRED");
    }

    // Check if user is still valid
    const user = tokenRecord.user;
    if (!user.isActive) {
      throw createError.forbidden("Account is deactivated", "USER_INACTIVE");
    }
    if (user.isBanned) {
      throw createError.forbidden(`Account is banned: ${user.banReason ?? "No reason provided"}`, "USER_BANNED");
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });

    // Parse duration to seconds
    const expiresIn = parseDurationToSeconds(env.jwt.accessExpiresIn);

    return { accessToken, expiresIn };
  }

  /**
   * Logout (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    await authRepository.revokeRefreshTokenByPlain(refreshToken);
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: number): Promise<number> {
    return authRepository.revokeAllUserTokens(userId);
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ sent: boolean }> {
    const user = await authRepository.findUserByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return { sent: true };
    }

    // Check rate limit (7 days between requests)
    if (user.lastPasswordResetRequest) {
      const daysSinceLastRequest = Math.floor(
        (Date.now() - user.lastPasswordResetRequest.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceLastRequest < env.security.passwordChangeCooldownDays) {
        const daysRemaining = env.security.passwordChangeCooldownDays - daysSinceLastRequest;
        throw createError.tooManyRequests(
          `You can only request password reset every ${env.security.passwordChangeCooldownDays} days. ${daysRemaining} days remaining.`,
        );
      }
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await authRepository.setResetToken(user.id, resetToken, expiresAt);

    // TODO: Send email with reset link
    // In production, integrate with Resend or another email service
    console.log(`[Auth] Password reset token for ${email}: ${resetToken}`);

    return { sent: true };
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordInput): Promise<void> {
    const user = await authRepository.findUserByResetToken(data.token);

    if (!user) {
      throw createError.badRequest("Invalid or expired reset token", "TOKEN_INVALID");
    }

    // Check if token is expired
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      await authRepository.clearResetToken(user.id);
      throw createError.badRequest("Reset token has expired", "TOKEN_EXPIRED");
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.isValid) {
      throw createError.badRequest(passwordValidation.errors[0] ?? "Invalid password", "INVALID_PASSWORD");
    }

    // Hash new password and update
    const passwordHash = await hashPassword(data.password);
    await authRepository.updatePassword(user.id, passwordHash);

    // Revoke all refresh tokens for security
    await authRepository.revokeAllUserTokens(user.id);
  }

  /**
   * Change password (authenticated)
   */
  async changePassword(userId: number, data: ChangePasswordInput): Promise<void> {
    const user = await authRepository.findUserById(userId);

    if (!user) {
      throw createError.notFound("User not found");
    }

    // Check rate limit
    if (user.lastPasswordChange) {
      const daysSinceLastChange = Math.floor((Date.now() - user.lastPasswordChange.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastChange < env.security.passwordChangeCooldownDays) {
        const daysRemaining = env.security.passwordChangeCooldownDays - daysSinceLastChange;
        throw createError.tooManyRequests(
          `You can only change password every ${env.security.passwordChangeCooldownDays} days. ${daysRemaining} days remaining.`,
        );
      }
    }

    // Verify current password
    const isValidPassword = await comparePassword(data.currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw createError.badRequest("Current password is incorrect", "INVALID_PASSWORD");
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(data.newPassword);
    if (!passwordValidation.isValid) {
      throw createError.badRequest(passwordValidation.errors[0] ?? "Invalid password", "INVALID_PASSWORD");
    }

    // Hash new password and update
    const passwordHash = await hashPassword(data.newPassword);
    await authRepository.updatePassword(userId, passwordHash);

    // Revoke all refresh tokens except current session
    // Note: In a more complex implementation, you'd pass the current token to exclude
    await authRepository.revokeAllUserTokens(userId);
  }

  /**
   * Get active sessions for a user
   */
  async getSessions(userId: number) {
    const tokens = await authRepository.getUserSessions(userId);
    return tokens.map((t) => ({
      id: t.id,
      deviceInfo: t.deviceInfo,
      ipAddress: t.ipAddress,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    }));
  }

  /**
   * Generate token pair for a user
   */
  private async generateTokens(user: User, meta?: RequestMeta): Promise<TokenPair> {
    // Generate access token
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });

    // Create refresh token in database
    const { token: refreshToken } = await authRepository.createRefreshToken({
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
      deviceInfo: parseDeviceInfo(meta?.userAgent),
    });

    const expiresIn = parseDurationToSeconds(env.jwt.accessExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }
}

/**
 * Parse duration string to seconds
 */
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // Default 15 minutes

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] ?? 60);
}

// Export singleton instance
export const authService = new AuthService();
