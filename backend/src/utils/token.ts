// ===========================================
// JWT Token Utilities
// ===========================================
// Token generation and verification

import jwt, { type SignOptions, type JwtPayload as JwtStandardPayload } from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import type { AccessTokenPayload, RefreshTokenPayload, TokenPair } from "../types/auth.types.js";

/**
 * Parse duration string to seconds
 * @param duration - Duration string (e.g., '15m', '7d', '1h')
 * @returns Duration in seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * multipliers[unit]!;
}

/**
 * Generate access token
 * @param payload - Token payload
 * @returns Signed JWT access token
 */
export function generateAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwt.accessExpiresIn as string & SignOptions["expiresIn"],
    algorithm: "HS256",
  };

  return jwt.sign({ ...payload, type: "access" }, env.jwt.accessSecret, options);
}

/**
 * Generate refresh token
 * @param payload - Token payload
 * @returns Signed JWT refresh token
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwt.refreshExpiresIn as string & SignOptions["expiresIn"],
    algorithm: "HS256",
  };

  return jwt.sign({ ...payload, type: "refresh" }, env.jwt.refreshSecret, options);
}

/**
 * Generate token pair (access + refresh)
 * @param accessPayload - Access token payload
 * @param refreshPayload - Refresh token payload
 * @returns Token pair with expiry info
 */
export function generateTokenPair(accessPayload: AccessTokenPayload, refreshPayload: RefreshTokenPayload): TokenPair {
  return {
    accessToken: generateAccessToken(accessPayload),
    refreshToken: generateRefreshToken(refreshPayload),
    expiresIn: parseDuration(env.jwt.accessExpiresIn),
  };
}

/**
 * Verify access token
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyAccessToken(token: string): (AccessTokenPayload & { type: string }) | null {
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret) as JwtStandardPayload &
      AccessTokenPayload & { type: string };

    if (decoded.type !== "access") {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify refresh token
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyRefreshToken(token: string): (RefreshTokenPayload & { type: string }) | null {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret) as JwtStandardPayload &
      RefreshTokenPayload & { type: string };

    if (decoded.type !== "refresh") {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Generate random token for password reset
 * @returns Random URL-safe token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Get refresh token expiry date
 * @returns Date when refresh token expires
 */
export function getRefreshTokenExpiry(): Date {
  const seconds = parseDuration(env.jwt.refreshExpiresIn);
  return new Date(Date.now() + seconds * 1000);
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value
 * @returns Token string or null
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
