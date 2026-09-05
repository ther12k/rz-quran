// Environment parsing and launch-safety checks.
// Production boot must fail closed on demo switches and missing policy config.
export type AppEnv = {
  appEnv: "development" | "test" | "staging" | "production";
  appOrigin: string;
  apiPort: number;
  databaseUrl: string;
  authSecret: string;
  authBaseUrl: string;
  smtpUrl: string | null;
  mailFrom: string | null;
  demoMode: boolean;
  productionChildEnrollmentEnabled: boolean;
  approvedPrivacyPolicyVersion: string | null;
  approvedConsentMethod: string | null;
}

export function parseEnv(source: Record<string, string | undefined>): AppEnv {
  const appEnv = (source.APP_ENV ?? "development") as AppEnv["appEnv"];
  if (!["development", "test", "staging", "production"].includes(appEnv)) {
    throw new Error(`Invalid APP_ENV: ${appEnv}`);
  }
  return {
    appEnv,
    appOrigin: source.APP_ORIGIN ?? "http://localhost:5173",
    apiPort: Number(source.API_PORT ?? 3000),
    databaseUrl: source.DATABASE_URL ?? "",
    authSecret: source.AUTH_SECRET ?? "",
    authBaseUrl: source.AUTH_BASE_URL ?? source.APP_ORIGIN ?? "http://localhost:5173",
    smtpUrl: source.SMTP_URL || null,
    mailFrom: source.MAIL_FROM || null,
    demoMode: source.DEMO_MODE === "true",
    productionChildEnrollmentEnabled: source.PRODUCTION_CHILD_ENROLLMENT_ENABLED === "true",
    approvedPrivacyPolicyVersion: source.APPROVED_PRIVACY_POLICY_VERSION || null,
    approvedConsentMethod: source.APPROVED_CONSENT_METHOD || null,
  };
}

export function loadEnv(): AppEnv {
  return parseEnv(process.env as Record<string, string | undefined>);
}

// Fail-closed production checks (T009/T061 subset). Returns a list of
// violations; an empty list means the configuration may boot in production.
export function productionReadinessViolations(env: AppEnv): string[] {
  const violations: string[] = [];
  if (env.appEnv !== "production") return violations;

  if (env.demoMode) {
    violations.push("DEMO_MODE must be false in production (demo fixtures/consent refused).");
  }
  if (!env.productionChildEnrollmentEnabled) {
    // This is the safe default; enabling requires the approvals below.
    violations.push(
      "Production child enrollment is disabled: PRODUCTION_CHILD_ENROLLMENT_ENABLED=false.",
    );
  } else {
    if (!env.approvedPrivacyPolicyVersion) {
      violations.push("PRODUCTION_CHILD_ENROLLMENT_ENABLED=true requires APPROVED_PRIVACY_POLICY_VERSION.");
    }
    if (!env.approvedConsentMethod) {
      violations.push("PRODUCTION_CHILD_ENROLLMENT_ENABLED=true requires APPROVED_CONSENT_METHOD.");
    }
  }
  if (env.databaseUrl.includes("local_only") || env.databaseUrl.includes("@127.0.0.1") || env.databaseUrl.includes("@localhost")) {
    violations.push("Production must not use a local loopback database URL.");
  }
  if (!env.authSecret || env.authSecret.length < 32 || env.authSecret.includes("replace_with")) {
    violations.push("AUTH_SECRET must be a generated secret of at least 32 characters.");
  }
  return violations;
}

// Consent assurance policy resolution (T015).
export type ConsentPolicy =
  | { kind: "production"; method: string; noticeVersion: string; policyVersion: string }
  | { kind: "demo" }
  | { kind: "blocked" };

export function consentPolicy(env: AppEnv): ConsentPolicy {
  if (env.appEnv === "production") {
    if (
      env.productionChildEnrollmentEnabled &&
      env.approvedConsentMethod &&
      env.approvedPrivacyPolicyVersion
    ) {
      return {
        kind: "production",
        method: env.approvedConsentMethod,
        noticeVersion: env.approvedPrivacyPolicyVersion,
        policyVersion: env.approvedPrivacyPolicyVersion,
      };
    }
    return { kind: "blocked" };
  }
  // Non-production: local demo assurance is permitted and must be labeled.
  return { kind: "demo" };
}
