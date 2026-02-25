// ===========================================
// Database Seed Script
// ===========================================
// Initial data for development

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123456", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      username: "admin",
      email: "admin@example.com",
      passwordHash: adminPassword,
      isAdmin: true,
      planType: "PREMIUM",
      planStatus: "ACTIVE",
      trialUses: 999,
      maxTrialUses: 999,
    },
  });

  console.log(`✅ Admin user created: ${admin.username} (${admin.email})`);

  // Create test user
  const testPassword = await bcrypt.hash("test123456", 12);

  const testUser = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      username: "testuser",
      email: "test@example.com",
      passwordHash: testPassword,
      isAdmin: false,
      planType: "FREE",
      planStatus: "ACTIVE",
      trialUses: 3,
      maxTrialUses: 3,
    },
  });

  console.log(`✅ Test user created: ${testUser.username} (${testUser.email})`);

  // Create default global settings
  const defaultSettings = [
    { key: "maintenanceMode", value: "false" },
    { key: "registrationEnabled", value: "true" },
    { key: "maxTrialUses", value: "3" },
    { key: "freeMaxComments", value: "100" },
    { key: "personalMaxComments", value: "5000" },
    { key: "premiumMaxComments", value: "50000" },
    { key: "freeConcurrency", value: "1" },
    { key: "jobTimeout", value: "300" },
    { key: "freePrice", value: "0" },
    { key: "personalPrice", value: "23" },
    { key: "premiumPrice", value: "45" },
    { key: "personalDuration", value: "3" },
    { key: "premiumDuration", value: "30" },
    { key: "freeRetentionDays", value: "1" },
    { key: "personalRetentionDays", value: "3" },
    { key: "premiumRetentionDays", value: "5" },
  ];

  for (const setting of defaultSettings) {
    await prisma.globalSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
    console.log(`✅ Setting created: ${setting.key}`);
  }

  console.log("🎉 Database seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
