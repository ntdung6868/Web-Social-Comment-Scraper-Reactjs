// ===========================================
// Database Seed Script
// ===========================================
// Initial data for development

import { PrismaClient, PlanType, PlanStatus } from "@prisma/client";
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
      planType: PlanType.PRO,
      planStatus: PlanStatus.ACTIVE,
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
      planType: PlanType.FREE,
      planStatus: PlanStatus.ACTIVE,
      trialUses: 3,
      maxTrialUses: 3,
    },
  });

  console.log(`✅ Test user created: ${testUser.username} (${testUser.email})`);

  // Create default global settings
  const defaultSettings = [
    { key: "global_proxy_enabled", value: "false" },
    { key: "global_proxy_list", value: "" },
    { key: "maintenance_mode", value: "false" },
    { key: "max_comments_free", value: "100" },
    { key: "max_comments_pro", value: "0" }, // 0 = unlimited
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
