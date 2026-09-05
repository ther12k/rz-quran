import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      { test: { name: "contracts", include: ["tests/contracts/**/*.test.ts"], environment: "node" } },
      {
        test: {
          name: "integration",
          include: ["tests/api/**/*.test.ts"],
          environment: "node",
          sequential: true,
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
      {
        test: {
          name: "security",
          include: ["tests/security/**/*.test.ts"],
          environment: "node",
          sequential: true,
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
