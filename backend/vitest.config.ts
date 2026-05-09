import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Don't pull tests from compiled output or node_modules
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "prisma"],
    // Most tests are pure logic; isolate is fine. Run sequentially to keep
    // any DB/Redis-touching tests from racing.
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Don't pretend module hooks work — let real ESM run.
    deps: {
      interopDefault: true,
    },
  },
});
