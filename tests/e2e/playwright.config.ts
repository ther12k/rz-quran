import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 45000,
  use: {
    baseURL: "http://localhost:5181",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "bun apps/api/src/index.ts",
      port: 3310,
      reuseExistingServer: true,
      env: {
        APP_ENV: "development",
        DATABASE_URL: "postgresql://rzq:local_only@127.0.0.1:5433/quran_kids",
        API_PORT: "3310",
        DEMO_MODE: "true",
        AUTH_SECRET: "development-secret-development-secret-12345",
      },
    },
    {
      command: "bun run --filter @rzq/web dev --port 5181",
      port: 5181,
      reuseExistingServer: true,
    },
  ],
  projects: [
    {
      name: "mobile-320",
      use: {
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "mobile-390",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "tablet-768",
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "desktop-1024",
      use: {
        viewport: { width: 1024, height: 768 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: "desktop-1440",
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
});
