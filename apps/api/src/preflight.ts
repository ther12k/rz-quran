#!/usr/bin/env bun
// T069: Production preflight. Aggregates every machine-checkable launch gate:
// config fail-closed checks, DB migration state, demo-data absence, content
// rights/review coverage, and required policy env vars. Exits non-zero with a
// itemized report when any gate fails. Human sign-offs (T063–T067, T070) are
// listed as PENDING-HUMAN and never auto-passed.
import postgres from "postgres";

const PASS = "PASS";
const FAIL = "FAIL";
const PENDING_HUMAN = "PENDING-HUMAN";

type Result = { gate: string; status: string; detail: string };

const results: Result[] = [];

function add(gate: string, status: string, detail: string) {
  results.push({ gate, status, detail });
}

const env = process.env;
const isProd = env.APP_ENV === "production";
const dbUrl = env.DATABASE_URL ?? "";

// 1. Configuration fail-closed gates
if (!isProd) {
  add("env.mode", PENDING_HUMAN, "APP_ENV != production; preflight expects APP_ENV=production for launch checks (run with production env for the real gate).");
} else {
  add("env.mode", PASS, "APP_ENV=production");
}

if (env.DEMO_MODE === "true") {
  add("env.demo_mode", FAIL, "DEMO_MODE=true is forbidden in production.");
} else {
  add("env.demo_mode", PASS, "demo mode disabled");
}

if (env.PRODUCTION_CHILD_ENROLLMENT_ENABLED !== "true") {
  add("env.enrollment", PENDING_HUMAN, "Child enrollment disabled: launch cannot serve real families until the approved policy is configured (T065).");
} else {
  const hasPolicy = Boolean(env.APPROVED_PRIVACY_POLICY_VERSION && env.APPROVED_CONSENT_METHOD);
  add("env.enrollment", hasPolicy ? PASS : FAIL, hasPolicy ? "policy versions configured" : "enrollment enabled without approved policy versions");
}

if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || env.AUTH_SECRET.includes("replace_with")) {
  add("env.auth_secret", FAIL, "AUTH_SECRET missing/weak/placeholder.");
} else {
  add("env.auth_secret", PASS, "secret present (>=32 chars)");
}

if (/(localhost|127\.0\.0\.1|local_only)/.test(dbUrl)) {
  add("env.database", FAIL, "Production must not use a loopback/local database URL.");
} else {
  add("env.database", PASS, "non-loopback database configured");
}

if (!env.SMTP_URL || !env.MAIL_FROM) {
  add("env.email", FAIL, "SMTP_URL and MAIL_FROM are required in production for email verification.");
} else {
  add("env.email", PASS, "email delivery configured");
}

// 2. Database-level gates (only when a reachable DB is configured)
if (dbUrl && !dbUrl.includes("example.invalid")) {
  try {
    const sql = postgres(dbUrl, { max: 1, connect_timeout: 5 });

    const [demo] = await sql`SELECT count(*)::int AS n FROM lesson_versions WHERE demo_only = true AND status = 'published'`;
    add(
      "content.demo_published",
      demo.n === 0 ? PASS : FAIL,
      demo.n === 0 ? "no demo-flagged published lessons" : `${demo.n} demo-flagged lessons are PUBLISHED (forbidden in production)`,
    );

    const [unreviewed] = await sql`
      SELECT count(*)::int AS n FROM lesson_versions
      WHERE status = 'published' AND (reviewer_id IS NULL OR release_hash IS NULL OR author_id = reviewer_id)`;
    add(
      "content.two_person_review",
      unreviewed.n === 0 ? PASS : FAIL,
      unreviewed.n === 0 ? "all published versions have distinct reviewer + hash" : `${unreviewed.n} published versions violate two-person review`,
    );

    const [rights] = await sql`
      SELECT count(*)::int AS n FROM lesson_versions v
      JOIN content_sources s ON s.id = ANY(v.source_ids)
      WHERE v.status = 'published' AND s.rights_status <> 'approved'`;
    add(
      "content.rights",
      rights.n === 0 ? PASS : FAIL,
      rights.n === 0 ? "all published lessons use approved-rights sources" : `${rights.n} published lessons depend on unapproved sources`,
    );

    const [orphan] = await sql`
      SELECT count(*)::int AS n FROM lessons l
      LEFT JOIN lesson_versions v ON v.id = l.current_version_id AND v.status = 'published'
      WHERE v.id IS NULL`;
    add(
      "content.current_pointer",
      orphan.n === 0 ? PASS : FAIL,
      orphan.n === 0 ? "every logical lesson points at a published version" : `${orphan.n} logical lessons lack a published current version`,
    );

    const [migrationsOk] = await sql`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_name IN ('deletion_suppressions', 'rate_limit_buckets', 'audit_events')`;
    add(
      "db.migrations",
      migrationsOk.n === 3 ? PASS : FAIL,
      migrationsOk.n === 3 ? "privacy/ops tables present (migrations applied)" : `missing tables (found ${migrationsOk.n}/3)`,
    );

    await sql.end();
  } catch (err) {
    add("db.reachable", FAIL, `cannot run DB gates: ${(err as Error).message}`);
  }
}

// 3. Human sign-off gates — always listed, never auto-passed.
const HUMAN_GATES: [string, string][] = [
  ["T063", "Content rights owner signed production source/recitation/distribution permissions"],
  ["T064", "Qualified curriculum reviewer (distinct from author) signed text/audio mappings by release hash"],
  ["T065", "Privacy/legal owner signed market eligibility, consent assurance flow, and retention plan"],
  ["T066", "Design/rights owner signed production artwork and missing-screen states"],
  ["T067", "Supervised usability pilot executed with recorded observations"],
  ["T070", "Explicit multi-owner release decision recorded"],
];
for (const [id, label] of HUMAN_GATES) {
  add(`human.${id}`, PENDING_HUMAN, `${label} — requires recorded external evidence; cannot be satisfied by tooling.`);
}

// Report
const failed = results.filter((r) => r.status === FAIL);
const pending = results.filter((r) => r.status === PENDING_HUMAN);
const passed = results.filter((r) => r.status === PASS);

console.log("\n=== RZ Qur'an Kids — Production Preflight ===\n");
for (const r of results) {
  console.log(` [${r.status.padEnd(13)}] ${r.gate}: ${r.detail}`);
}
console.log(`\nSummary: ${passed.length} pass · ${failed.length} FAIL · ${pending.length} pending-human\n`);

if (failed.length > 0) {
  console.error("PREFLIGHT: FAIL — launch blocked by machine gates above.");
  process.exit(1);
}
if (pending.length > 0) {
  console.error("PREFLIGHT: BLOCKED — machine gates pass but human sign-offs remain (T063–T067, T070).");
  process.exit(2);
}
console.log("PREFLIGHT: ALL GATES GREEN.");
process.exit(0);
