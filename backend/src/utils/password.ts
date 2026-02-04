// ===========================================
// Password Utilities
// ===========================================
// Secure password hashing using bcrypt

import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(env.security.bcryptSaltRounds);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a password with a hash
 * @param password - Plain text password to check
 * @param hash - Hashed password to compare against
 * @returns True if password matches
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Validation result with error message if invalid
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // Optional: Add more complex requirements
  // if (!/[A-Z]/.test(password)) {
  //   errors.push('Password must contain at least one uppercase letter');
  // }
  // if (!/[a-z]/.test(password)) {
  //   errors.push('Password must contain at least one lowercase letter');
  // }
  // if (!/[0-9]/.test(password)) {
  //   errors.push('Password must contain at least one number');
  // }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
