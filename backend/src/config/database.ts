// ===========================================
// Database Configuration (Prisma)
// ===========================================
// Singleton Prisma client instance

import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

// Declare global type for Prisma client (prevents multiple instances in dev)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create Prisma client with logging in development
const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClient({
    log: env.isDevelopment ? ["info", "warn", "error"] : ["error"],
    errorFormat: env.isDevelopment ? "pretty" : "minimal",
  });
};

// Use global instance in development to prevent hot-reload issues
export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (env.isDevelopment) {
  globalThis.prisma = prisma;
}

// ===========================================
// Database Connection Utilities
// ===========================================

/**
 * Connect to database and verify connection
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log("📤 Database disconnected");
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
