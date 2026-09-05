// Unit checks for the environment safety gates (T009/T061 subset).
import { describe, expect, it } from "vitest";
import { parseEnv, productionReadinessViolations, consentPolicy } from "../../apps/api/src/env.ts";

const base = {
  APP_ENV: "development",
  APP_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://u:p@db.example.internal:5432/app",
  AUTH_SECRET: "x".repeat(40),
};

describe("production readiness", () => {
  it("rejects demo mode in production", () => {
    const env = parseEnv({ ...base, APP_ENV: "production", DEMO_MODE: "true" });
    expect(productionReadinessViolations(env).join("\n")).toContain("DEMO_MODE");
  });

  it("rejects loopback databases in production", () => {
    const env = parseEnv({ ...base, APP_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost:5432/app" });
    expect(productionReadinessViolations(env).join("\n")).toContain("loopback");
  });

  it("requires approved policy when enrollment enabled", () => {
    const env = parseEnv({ ...base, APP_ENV: "production", PRODUCTION_CHILD_ENROLLMENT_ENABLED: "true" });
    const violations = productionReadinessViolations(env).join("\n");
    expect(violations).toContain("APPROVED_PRIVACY_POLICY_VERSION");
    expect(violations).toContain("APPROVED_CONSENT_METHOD");
  });

  it("keeps enrollment blocked by default in production", () => {
    const env = parseEnv({ ...base, APP_ENV: "production" });
    expect(productionReadinessViolations(env).join("\n")).toContain("disabled");
  });

  it("non-production never reports production violations", () => {
    const env = parseEnv({ ...base, DEMO_MODE: "true" });
    expect(productionReadinessViolations(env)).toEqual([]);
  });
});

describe("consent policy resolution", () => {
  it("non-production resolves to demo policy", () => {
    expect(consentPolicy(parseEnv({ ...base, DEMO_MODE: "true" })).kind).toBe("demo");
  });

  it("production without approvals is blocked (fail closed)", () => {
    expect(consentPolicy(parseEnv({ ...base, APP_ENV: "production" })).kind).toBe("blocked");
  });
});
