// ===========================================
// Authentication Types & Interfaces
// ===========================================
// Strict TypeScript definitions for Auth-related data

import type { UserPublic } from "./user.types.js";

/**
 * Login request payload
 */
export interface LoginPayload {
  username: string; // Can be username or email
  password: string;
  rememberMe?: boolean;
}

/**
 * Register request payload
 */
export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Forgot password request payload
 */
export interface ForgotPasswordPayload {
  email: string;
}

/**
 * Reset password request payload
 */
export interface ResetPasswordPayload {
  token: string;
  password: string;
  confirmPassword: string;
}

/**
 * JWT Token payload (what's encoded in the token)
 */
export interface JwtPayload {
  userId: number;
  username: string;
  email: string;
  isAdmin: boolean;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

/**
 * Access token payload (minimal info)
 */
export interface AccessTokenPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
}

/**
 * Refresh token payload
 */
export interface RefreshTokenPayload {
  userId: number;
  tokenId: number;
}

/**
 * Token pair returned on login/refresh
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Access token expiry in seconds
}

/**
 * Auth response (login/register success)
 */
export interface AuthResponse {
  user: UserPublic;
  tokens: TokenPair;
}

/**
 * Refresh token response
 */
export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

/**
 * Decoded refresh token from database
 */
export interface StoredRefreshToken {
  id: number;
  token: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Request user (attached to req by auth middleware)
 */
export interface RequestUser {
  userId: number;
  username: string;
  email: string;
  isAdmin: boolean;
}
