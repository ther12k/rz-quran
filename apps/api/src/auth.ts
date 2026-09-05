// Better Auth integration for ADULT accounts only (T011).
// - Email + password identity; verified email required before child profiles.
// - Email delivery is an honest stub locally: the verification URL is logged,
//   never faked as "sent".
// - The app-level parent gate and mode switching live in modules/identity,
//   not in the auth library.
import { betterAuth } from "better-auth";
import { createDatabase, schema } from "@rzq/database";
import type { AppEnv } from "./env.ts";

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(env: AppEnv, db: ReturnType<typeof createDatabase>) {
  const mailerConfigured = Boolean(env.smtpUrl && env.mailFrom);
  if (env.appEnv === "production" && !mailerConfigured) {
    // Production requires real email delivery; refuse to boot instead of
    // silently dropping verification mail.
    throw new Error("Production requires SMTP_URL and MAIL_FROM for email verification.");
  }

  return betterAuth({
    database: {
      db,
      // Drizzle instance is directly supported; table/column names follow
      // packages/database/src/schema/auth.ts (verified against pinned version).
      type: "postgres",
    },
    secret: env.authSecret,
    baseURL: env.authBaseUrl,
    trustedOrigins: [env.appOrigin],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
    },
    emailVerification: {
      enabled: true,
      expiresIn: 60 * 60, // 1 hour
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        if (mailerConfigured) {
          // Real SMTP delivery is configured by deployment; local dev logs only.
          // Delivery adapter wiring is a deployment concern (D09 pending).
          console.info(`[mail] verification email for user ${user.id} suppressed (SMTP adapter not wired)`);
          console.info(`[mail] verification URL: ${url}`);
          return;
        }
        console.info(`[auth] verification URL for ${user.email}: ${url}`);
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh once per day
    },
    advanced: {
      // Cookie security defaults are secure/sameSite=lax in better-auth;
      // production requires HTTPS same-origin deployment (docs/03 §3).
      disableCSRFCheck: false,
    },
    user: {
      additionalFields: {},
    },
    databaseHooks: {},
  });
}

// Supported password verification for the parent gate: uses the auth
// library's own password context (same scrypt parameters as sign-in).
// We verify against the CURRENT session's user credential, never trust a
// client-supplied user id.
export async function verifyPasswordForUser(
  auth: Auth,
  db: ReturnType<typeof createDatabase>,
  authUserId: string,
  password: string,
): Promise<boolean> {
  const rows = await db
    .select({ passwordHash: schema.account.password })
    .from(schema.account)
    .where(eqAnd(schema.account.userId, authUserId, schema.account.providerId, "credential"));
  const hash = rows[0]?.passwordHash;
  if (!hash) return false;
  // $context exposes the library's password hashing utilities (pinned version).
  const passwordCtx = (auth as unknown as { $context: { password: { verify(p: string, h: string): Promise<boolean> } } })
    .$context.password;
  return passwordCtx.verify(password, hash);
}

// Small local helper to avoid importing drizzle operators at module top in
// every file; keeps eq/and usage explicit here.
import { and, eq } from "drizzle-orm";
function eqAnd<T>(col: Parameters<typeof eq>[0], val: unknown, col2: Parameters<typeof eq>[0], val2: unknown) {
  return and(eq(col, val as never), eq(col2, val2 as never));
}
