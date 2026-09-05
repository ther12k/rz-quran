// Transport idempotency (docs/05 §3): scoped key + method + route, request
// hash, stored response. Never used for gate requests (passwords).
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@rzq/database";
import { ApiError } from "./errors.ts";

export async function sha256Json(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value ?? null)),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type StoredResponse = { status: number; body: unknown };

export async function withIdempotency(params: {
  db: Database;
  actorScope: string;
  parentId?: string | null;
  method: string;
  route: string;
  key: string | null;
  requestBody: unknown;
  handler: () => Promise<StoredResponse>;
}): Promise<StoredResponse & { replayed: boolean }> {
  const { db, actorScope, method, route, handler } = params;
  const requestHash = await sha256Json(params.requestBody);

  if (!params.key || !/^[0-9a-fA-F-]{36}$/.test(params.key)) {
    const result = await handler();
    return { ...result, replayed: false };
  }

  const existing = await db
    .select()
    .from(schema.idempotencyRecords)
    .where(
      and(
        eq(schema.idempotencyRecords.actorScope, actorScope),
        eq(schema.idempotencyRecords.method, method),
        eq(schema.idempotencyRecords.route, route),
        eq(schema.idempotencyRecords.idempotencyKey, params.key),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0]!;
    if (record.requestSha256 !== requestHash) {
      throw new ApiError(
        "IDEMPOTENCY_CONFLICT",
        "Permintaan tidak cocok dengan kunci idempotensi yang sama.",
      );
    }
    return { status: record.responseStatus, body: record.responseBody, replayed: true };
  }

  const result = await handler();
  if (result.status < 500) {
    await db
      .insert(schema.idempotencyRecords)
      .values({
        actorScope,
        parentId: params.parentId ?? null,
        method,
        route,
        idempotencyKey: params.key,
        requestSha256: requestHash,
        responseStatus: result.status,
        responseBody: result.body as object,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing();
  }
  return { ...result, replayed: false };
}
