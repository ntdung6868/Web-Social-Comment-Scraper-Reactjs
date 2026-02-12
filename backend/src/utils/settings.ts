// ===========================================
// Global Settings Helper
// ===========================================
// Centralized utility to read global settings with typed defaults.
// Every configurable value in the system should go through here.

import { adminRepository } from "../repositories/admin.repository.js";

// ── Default Values ───────────────────────────────
const DEFAULTS = {
  // System
  maintenanceMode: "false",
  registrationEnabled: "true",

  // Limits
  maxTrialUses: "3",
  freeMaxComments: "100",
  personalMaxComments: "5000",
  premiumMaxComments: "50000",

  // Performance
  freeConcurrency: "1",
  jobTimeout: "300", // seconds

  // Security
  sessionMaxAge: "7", // days

  // Pricing
  freePrice: "0",
  personalPrice: "23",
  premiumPrice: "45",
  personalDuration: "3",
  premiumDuration: "30",

  // Retention
  freeRetentionDays: "1",
  personalRetentionDays: "3",
  premiumRetentionDays: "5",

  // Contact
  contactEmail: "",
  contactPhone: "",
} as const;

export type SettingKey = keyof typeof DEFAULTS;

// ── Getters ──────────────────────────────────────

/**
 * Get a single setting value with fallback to default
 */
export async function getSetting(key: SettingKey): Promise<string> {
  const value = await adminRepository.getSetting(key);
  return value ?? DEFAULTS[key];
}

/**
 * Get a setting as a number
 */
export async function getSettingNumber(key: SettingKey): Promise<number> {
  const value = await getSetting(key);
  const num = parseInt(value, 10);
  return isNaN(num) ? parseInt(DEFAULTS[key], 10) : num;
}

/**
 * Get a setting as a boolean
 */
export async function getSettingBool(key: SettingKey): Promise<boolean> {
  const value = await getSetting(key);
  return value === "true";
}

/**
 * Get plan comment limits (batch read)
 */
export async function getPlanMaxComments(): Promise<Record<string, number>> {
  const [free, personal, premium] = await Promise.all([
    getSettingNumber("freeMaxComments"),
    getSettingNumber("personalMaxComments"),
    getSettingNumber("premiumMaxComments"),
  ]);
  return { FREE: free, PERSONAL: personal, PREMIUM: premium };
}

/**
 * Get plan retention days (batch read)
 */
export async function getPlanRetentionDays(): Promise<Record<string, number>> {
  const [free, personal, premium] = await Promise.all([
    getSettingNumber("freeRetentionDays"),
    getSettingNumber("personalRetentionDays"),
    getSettingNumber("premiumRetentionDays"),
  ]);
  return { FREE: free, PERSONAL: personal, PREMIUM: premium };
}

/**
 * Get plan pricing info (batch read)
 */
export async function getPlanPricing(): Promise<Record<string, { price: number; duration: number }>> {
  const [freePrice, personalPrice, premiumPrice, personalDuration, premiumDuration] = await Promise.all([
    getSettingNumber("freePrice"),
    getSettingNumber("personalPrice"),
    getSettingNumber("premiumPrice"),
    getSettingNumber("personalDuration"),
    getSettingNumber("premiumDuration"),
  ]);
  return {
    FREE: { price: freePrice, duration: 0 },
    PERSONAL: { price: personalPrice, duration: personalDuration },
    PREMIUM: { price: premiumPrice, duration: premiumDuration },
  };
}

/**
 * Get contact info (batch read)
 */
export async function getContactInfo(): Promise<{ email: string; phone: string }> {
  const [email, phone] = await Promise.all([getSetting("contactEmail"), getSetting("contactPhone")]);
  return { email, phone };
}

/**
 * Get all defaults (for display / reference)
 */
export function getDefaults(): typeof DEFAULTS {
  return DEFAULTS;
}
