// Privacy operations (M4): suppression ledger and consent withdrawals are
// append-only; the ledger prevents deleted profiles from returning after a
// backup restore (T054).
import { integer, pgTable, primaryKey, text, timestamp, uuid, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const deletionSuppressions = pgTable(
  "deletion_suppressions",
  {
    id: uuid("id").primaryKey(),
    // What was deleted: child profile, parent account, or auth user.
    scope: text("scope").notNull().$type<"child" | "parent" | "auth_user">(),
    // Reference key: child UUID, parent UUID, or auth user id. Not a FK:
    // the referenced row is deleted, this ledger intentionally outlives it.
    referenceKey: text("reference_key").notNull(),
    nicknameHash: text("nickname_hash"),
    reason: text("reason").notNull().$type<"parent_request" | "account_deletion" | "policy">(),
    requestedBy: text("requested_by").notNull(),
    suppressedAt: timestamp("suppressed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("deletion_suppressions_unique").on(t.scope, t.referenceKey),
    check("suppression_scope_domain", sql`${t.scope} in ('child','parent','auth_user')`),
    check("suppression_reason_domain", sql`${t.reason} in ('parent_request','account_deletion','policy')`),
  ],
);

// Shared rate-limit buckets (T055): survives across API replicas so limits
// hold cluster-wide. Stale windows are simply abandoned (new rows per window).
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    bucketKey: text("bucket_key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    hitCount: integer("hit_count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucketKey, t.windowStart] })],
);
