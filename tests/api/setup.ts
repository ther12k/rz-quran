// Integration test harness: disposable PostgreSQL per worker, migrations,
// demo seed, in-memory app, and cookie-aware request helpers.
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { buildApp } from "../../apps/api/src/index.ts";
import { createDatabase } from "@rzq/database";

const execFileAsync = promisify(execFile);

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgresql://rzq:local_only@127.0.0.1:5433/postgres";
const TEMPLATE_URL = "postgresql://rzq:local_only@127.0.0.1:5433/quran_kids";

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;

let counter = 0;

export async function createTestApp() {
  const dbName = `rzq_test_${process.pid}_${++counter}`;
  const admin = postgres(ADMIN_URL, { max: 1 });
  await admin`create database ${admin(dbName)}`;
  await admin.end();

  const dbUrl = `postgresql://rzq:local_only@127.0.0.1:5433/${dbName}`;
  const db = createDatabase(dbUrl);
  await migrate(db, {
    migrationsFolder: resolve(import.meta.dirname, "../../packages/database/migrations"),
  });

  // Demo seed guarded to non-production; run via child process for the guard
  // logic to be exercised exactly as shipped.
  await execFileAsync("bun", [resolve(import.meta.dirname, "../../packages/database/src/seed-demo.ts")], {
    env: { ...process.env, DATABASE_URL: dbUrl, APP_ENV: "test", DEMO_MODE: "true" },
  });

  // better-auth 1.7 issues a stateless JWT verification token surfaced
  // through the sendVerificationEmail callback; tests capture it from there
  // (a real recipient would receive it by mail).
  const verificationUrls: string[] = [];
  const built = buildApp(
    undefined,
    {
      APP_ENV: "test",
      DATABASE_URL: dbUrl,
      AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      AUTH_BASE_URL: "http://test.local",
      APP_ORIGIN: "http://test.local",
      DEMO_MODE: "true",
    },
    { onVerificationEmail: (url) => verificationUrls.push(url) },
  );

  const baseUrl = "http://test.local";
  const sql = postgres(dbUrl, { max: 2 });

  return {
    app: built.app,
    sql,
    baseUrl,
    verificationUrls,
    async destroy() {
      await sql.end();
      await (db.$client as unknown as { end(): Promise<void> }).end();
      const dropAdmin = postgres(ADMIN_URL, { max: 1 });
      await dropAdmin`drop database if exists ${dropAdmin(dbName)} with (force)`;
      await dropAdmin.end();
    },
  };
}

// Cookie-aware fetch against the in-memory app.
export function makeClient(app: TestApp["app"], baseUrl: string) {
  let cookie = "";
  return {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value;
    },
    async call(method: string, path: string, opts: { body?: unknown; idempotencyKey?: string; expectStatus?: number; raw?: boolean } = {}) {
      const headers: Record<string, string> = {
        Origin: "http://test.local",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      };
      const res = await app.fetch(
        new Request(`${baseUrl}${path}`, {
          method,
          headers,
          ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
        }),
      );
      const setCookie = res.headers.getSetCookie?.() ?? [];
      for (const c of setCookie) {
        const [pair] = c.split(";");
        if (pair) {
          const [name, value] = pair.split("=");
          if (value === "" || name.includes("csrf")) continue;
          const existing = Object.fromEntries(
            cookie
              .split("; ")
              .filter(Boolean)
              .map((p) => p.split("=") as [string, string]),
          );
          existing[name.trim()] = value;
          cookie = Object.entries(existing)
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
        }
      }
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      return { status: res.status, json, headers: res.headers };
    },
  };
}

// Sign up + verify + sign in. The verification token is captured from the
// mailer callback (an email recipient would get it by mail).
export async function signUpVerifiedParent(app: TestApp["app"], harness: TestApp, baseUrl: string, email: string, password = "kata-sandi-aman-123") {
  const client = makeClient(app, baseUrl);
  const signUp = await client.call("POST", "/api/auth/sign-up/email", {
    body: { name: "Orang Tua Tes", email, password },
  });
  if (signUp.status >= 400) throw new Error(`sign-up failed: ${JSON.stringify(signUp.json)}`);
  const issued = harness.verificationUrls.at(-1);
  if (!issued) throw new Error("verification email not issued");
  const token = new URL(issued).searchParams.get("token");
  if (!token) throw new Error("verification token missing");
  await client.call("GET", `/api/auth/verify-email?token=${encodeURIComponent(token)}`);
  const signIn = await client.call("POST", "/api/auth/sign-in/email", { body: { email, password } });
  if (signIn.status !== 200) throw new Error(`sign-in failed: ${JSON.stringify(signIn.json)}`);
  return client;
}

export const DEMO_LESSON_UNITS = {
  instruction: "00000000-0000-4000-8000-00000000d0a1",
  letterBa: "00000000-0000-4000-8000-00000000d0a2",
  letterAlif: "00000000-0000-4000-8000-00000000d0a3",
  choice: "00000000-0000-4000-8000-00000000d0a4",
} as const;

export const DEMO_LESSON_ID = "00000000-0000-4000-8000-00000000d010";
