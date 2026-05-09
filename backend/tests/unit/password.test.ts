import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { hashPassword, comparePassword, validatePasswordStrength } from "../../src/utils/password.js";

describe("password util", () => {
  it("hash + compare round trip", async () => {
    const plain = "correct horse battery staple";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
    expect(await comparePassword(plain, hash)).toBe(true);
    expect(await comparePassword("wrong", hash)).toBe(false);
  });

  it("hashes the same password to different digests (random salt)", async () => {
    const plain = "abc12345";
    const a = await hashPassword(plain);
    const b = await hashPassword(plain);
    expect(a).not.toBe(b);
    // …yet both verify
    expect(await comparePassword(plain, a)).toBe(true);
    expect(await comparePassword(plain, b)).toBe(true);
  });

  it("verifies hashes generated at older bcrypt rounds (back-compat)", async () => {
    // Hash with the OLD rounds=10 the way pre-bump deploys did, then
    // verify it still passes through the current comparePassword. Proves
    // bumping BCRYPT_SALT_ROUNDS to 12 doesn't lock out existing users.
    const oldRoundsHash = await bcrypt.hash("legacy-pwd-2026", 10);
    expect(oldRoundsHash).toContain("$2a$10$"); // sanity: rounds=10 is encoded
    expect(await comparePassword("legacy-pwd-2026", oldRoundsHash)).toBe(true);
    expect(await comparePassword("guess", oldRoundsHash)).toBe(false);
  });

  describe("validatePasswordStrength", () => {
    it("rejects passwords shorter than 8 chars", () => {
      const r = validatePasswordStrength("abc12");
      expect(r.isValid).toBe(false);
      expect(r.errors).toContain("Password must be at least 8 characters long");
    });

    it("accepts an 8+ char password", () => {
      expect(validatePasswordStrength("12345678").isValid).toBe(true);
    });
  });
});
