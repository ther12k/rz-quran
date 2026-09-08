// Staging-only native pairing state (GDM-009). The whole module is mounted
// only outside production and the routes additionally refuse in production.
// Secrets are stored hashed only: the 8-character human code and the 256-bit
// grant token never touch disk in plaintext; the PKCE-style S256
// code_challenge is not a secret (the verifier stays native-side).
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { children, parents } from "./identity.ts";

/** Verifier-bound pairing: native holds the verifier, parent approves, native redeems once. */
export const kidsPairings = pgTable(
  "kids_pairings",
  {
    id: uuid("id").primaryKey(),
    // sha256 of the 8-character human code (unambiguous alphabet).
    codeHash: text("code_hash").notNull().unique(),
    // base64url(SHA-256(code_verifier)); compared before any sensitive lookup.
    codeChallenge: text("code_challenge").notNull(),
    status: text("status")
      .notNull()
      .default("pending")
      .$type<"pending" | "approved" | "denied" | "redeemed" | "expired">(),
    approvedChildId: uuid("approved_child_id").references(() => children.id, { onDelete: "cascade" }),
    approvedByParentId: uuid("approved_by_parent_id").references(() => parents.id, { onDelete: "cascade" }),
    // Bounded pairing-wide attempt counter (wrong verifier/code increments it).
    attemptCount: integer("attempt_count").notNull().default(0),
    clientBuildId: text("client_build_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  },
  (t) => [
    index("kids_pairings_status_idx").on(t.status, t.expiresAt),
    check("kids_pairings_status_domain", sql`${t.status} in ('pending','approved','denied','redeemed','expired')`),
    check("kids_pairings_attempts_bounded", sql`${t.attemptCount} >= 0 and ${t.attemptCount} <= 1000`),
    check("kids_pairings_expiry_after_creation", sql`${t.expiresAt} > ${t.createdAt}`),
    check(
      "kids_pairings_approved_shape",
      sql`${t.status} <> 'approved' or (${t.approvedChildId} is not null and ${t.approvedByParentId} is not null)`,
    ),
  ],
);

/** One-use opaque bearer grant (staging audience) issued after parent approval. */
export const kidsGrants = pgTable(
  "kids_grants",
  {
    id: uuid("id").primaryKey(),
    pairingId: uuid("pairing_id").references(() => kidsPairings.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => parents.id, { onDelete: "cascade" }),
    // sha256 of the opaque 256-bit token; the token itself lives only in
    // native memory (no refresh token, no persistent login in this MVP).
    tokenHash: text("token_hash").notNull().unique(),
    // Audience and minting environment are bound SERVER-SIDE; the middleware
    // compares these stored columns, never client input (GDM-004 P4).
    audience: text("audience").notNull().default("rzq-kids-staging"),
    mintedEnv: text("minted_env").notNull().$type<"development" | "test" | "staging">(),
    lessonAllowlist: jsonb("lesson_allowlist").notNull().default(sql`'[]'::jsonb`),
    clientBuildId: text("client_build_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
  },
  (t) => [
    index("kids_grants_child_idx").on(t.childId, t.revokedAt),
    uniqueIndex("kids_grants_one_live_per_child")
      .on(t.childId)
      .where(sql`${t.revokedAt} is null`),
    check("kids_grants_expiry_after_creation", sql`${t.expiresAt} > ${t.createdAt}`),
    check("kids_grants_audience_domain", sql`${t.audience} = 'rzq-kids-staging'`),
  ],
);

/** Throttle ledger: polls and code-entry failures by pairing and network source. */
export const kidsPairingAttempts = pgTable(
  "kids_pairing_attempts",
  {
    id: uuid("id").primaryKey(),
    // Nullable: attempts against unknown/bogus pairing ids are recorded too.
    pairingId: uuid("pairing_id").references(() => kidsPairings.id, { onDelete: "set null" }),
    // sha256 of the network source (IP) — the raw address is never stored.
    sourceHash: text("source_hash").notNull(),
    kind: text("kind").notNull().$type<"poll" | "code_entry">(),
    accepted: boolean("accepted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("kids_pairing_attempts_source_idx").on(t.sourceHash, t.createdAt.desc()),
    index("kids_pairing_attempts_pairing_idx").on(t.pairingId, t.createdAt.desc()),
    check("kids_pairing_attempts_kind_domain", sql`${t.kind} in ('poll','code_entry')`),
  ],
);
