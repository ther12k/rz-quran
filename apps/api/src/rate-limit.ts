// Distributed-enough rate limiting (T055): PostgreSQL counter buckets.
// Per API replica safety + shared store so limits hold across replicas.
// Learning events: 120 req/min per session. Gate attempts: 5 per 15 min.
import { sql } from "drizzle-orm";
import type { Database } from "@rzq/database";
import { ApiError } from "./errors.ts";

type BucketResult = { allowed: boolean; retryAfterSec: number };

export async function checkRateLimit(
  db: Database,
  bucketKey: string,
  limit: number,
  windowSec: number,
): Promise<BucketResult> {
  const count = await currentHitCount(db, bucketKey, windowSec);
  if (count >= limit) {
    return { allowed: false, retryAfterSec: windowSec };
  }
  await recordRateLimitHit(db, bucketKey, windowSec);
  return { allowed: true, retryAfterSec: 0 };
}

async function currentHitCount(db: Database, bucketKey: string, windowSec: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT hit_count FROM rate_limit_buckets
    WHERE bucket_key = ${bucketKey}
      AND window_start = to_timestamp(floor(extract(epoch from now()) / ${windowSec}) * ${windowSec})
  `);
  const rows = (result as unknown as { hit_count?: number }[]) ?? [];
  return rows[0]?.hit_count ?? 0;
}

export async function recordRateLimitHit(db: Database, bucketKey: string, windowSec: number): Promise<void> {
  // Fixed aligned windows: bucket key + window start form the PK, so each
  // window gets a fresh row and counts accumulate within the window.
  await db.execute(sql`
    WITH window_start_ts AS (
      SELECT to_timestamp(floor(extract(epoch from now()) / ${windowSec}) * ${windowSec}) AS ws
    ), upsert AS (
      INSERT INTO rate_limit_buckets (bucket_key, window_start, hit_count)
      SELECT ${bucketKey}, ws, 1 FROM window_start_ts
      ON CONFLICT (bucket_key, window_start)
      DO UPDATE SET hit_count = rate_limit_buckets.hit_count + 1
      RETURNING hit_count
    )
    SELECT hit_count FROM upsert
  `);
}

export const RATE_LIMITS = {
  gateAttempt: { key: "gate", limit: 5, windowSec: 15 * 60 },
  learningEvents: { key: "events", limit: 120, windowSec: 60 },
  signIn: { key: "signin", limit: 5, windowSec: 15 * 60 },
} as const;

export async function enforceRateLimit(
  db: Database,
  family: { key: string; limit: number; windowSec: number },
  subject: string,
) {
  const res = await checkRateLimit(db, `${family.key}:${subject}`, family.limit, family.windowSec);
  if (!res.allowed) {
    throw new ApiError("RATE_LIMITED", "Terlalu banyak percobaan. Tunggu sebentar, ya.");
  }
}

// Read-only budget check for limits that must count only failures (gate):
// blocks when the failure bucket is full without consuming a slot.
export async function checkRateLimitPeek(
  db: Database,
  bucketKey: string,
  family: { limit: number; windowSec: number },
): Promise<boolean> {
  const count = await currentHitCount(db, bucketKey, family.windowSec);
  return count < family.limit;
}
