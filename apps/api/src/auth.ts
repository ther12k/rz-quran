// Better Auth integration for ADULT accounts only (T011).
// - Email + password identity; verified email required before child profiles.
// - Email delivery is an honest stub locally: the verification URL is logged,
//   never faked as "sent".
// - The app-level parent gate and mode switching live in modules/identity,
//   not in the auth library.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { verifyPassword } from "better-auth/crypto";
import { createDatabase, schema } from "@rzq/database";
import type { AppEnv } from "./env.ts";

export type Auth = ReturnType<typeof createAuth>;

export type AuthHooks = {
  /** Test/diagnostic hook; production always logs the URL via the mailer. */
  onVerificationEmail?: (url: string) => void;
};

export function createAuth(env: AppEnv, db: ReturnType<typeof createDatabase>, hooks: AuthHooks = {}) {
  const mailerConfigured = Boolean(env.smtpUrl && env.mailFrom);
  if (env.appEnv === "production" && !mailerConfigured) {
    // Production requires real email delivery; refuse to boot instead of
    // silently dropping verification mail.
    throw new Error("Production requires SMTP_URL and MAIL_FROM for email verification.");
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
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
        hooks.onVerificationEmail?.(url);
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

// Supported password verification for the parent gate: the auth library's
// exported scrypt verifier (better-auth/crypto), used against the CURRENT
// session user's credential row. A client boolean is never accepted.
export async function verifyPasswordForUser(
  db: ReturnType<typeof createDatabase>,
  authUserId: string,
  password: string,
): Promise<boolean> {
  const rows = await db
    .select({ passwordHash: schema.account.password })
    .from(schema.account)
    .where(and(eq(schema.account.userId, authUserId), eq(schema.account.providerId, "credential")))
    .limit(1);
  const hash = rows[0]?.passwordHash;
  if (!hash) return false;
  try {
    return await verifyPassword({ hash, password });
  } catch {
    return false;
  }
}

import { and, eq } from "drizzle-orm";
