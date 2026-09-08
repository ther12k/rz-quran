// Staging-only native grant authentication (GDM-009).
//
// A grant is an opaque 256-bit bearer token issued once per approved pairing.
// Hash lookup only — the plaintext token lives exclusively in native memory.
// The audience and minting environment are read from the STORED grant row
// (GDM-004 P4) and must match the serving environment before any handler or
// profile data is touched (P2). Production never enters this path (P1/P2).
import { and, eq, isNull, sql } from "drizzle-orm";
import { schema, type Database } from "@rzq/database";
import { ApiError } from "./errors.ts";
import type { AppEnv } from "./env.ts";
import type { ChildContext } from "./modules/context.ts";

/** Staging audience bound server-side at issuance (platform-auth.md §Android). */
export const KIDS_GRANT_AUDIENCE = "rzq-kids-staging";

/** Grant auth may only engage outside production and with the module enabled. */
export function grantAuthAllowed(env: AppEnv): boolean {
  return env.kidsPairingEnabled && env.appEnv !== "production";
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** S256 challenge form: base64url(SHA-256(verifier)), unpadded (RFC 7636). */
export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Buffer.from(digest).toString("base64url");
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1]! : null;
}

/**
 * Token lookup + all validity checks; returns the stored grant row or throws
 * neutral AUTH_REQUIRED — no distinction between unknown/expired/revoked/
 * mismatched tokens (no oracle for token states).
 */
export async function resolveLiveGrant(db: Database, request: Request, env: AppEnv) {
  if (!grantAuthAllowed(env)) {
    throw new ApiError("AUTH_REQUIRED", "Sesi berakhir. Silakan masuk lagi.");
  }
  const token = bearerToken(request);
  if (!token) throw new ApiError("AUTH_REQUIRED", "Sesi berakhir. Silakan masuk lagi.");

  const tokenHash = await sha256Hex(token);
  const grantRows = await db
    .select()
    .from(schema.kidsGrants)
    .where(eq(schema.kidsGrants.tokenHash, tokenHash))
    .limit(1);
  const grant = grantRows[0];
  if (
    !grant ||
    grant.revokedAt !== null ||
    grant.expiresAt.getTime() <= Date.now() ||
    grant.audience !== KIDS_GRANT_AUDIENCE ||
    grant.mintedEnv !== env.appEnv
  ) {
    throw new ApiError("AUTH_REQUIRED", "Sesi berakhir. Silakan masuk lagi.");
  }
  return grant;
}

/**
 * Resolve a native request into a child context through a staging grant.
 * Throws neutral AUTH_REQUIRED for any failure — no distinction between
 * unknown/expired/revoked/mismatched tokens (no oracle for token states).
 */
export async function resolveGrantChildSession(db: Database, request: Request, env: AppEnv): Promise<ChildContext> {
  const grant = await resolveLiveGrant(db, request, env);
  // Fresh per-request authorization state: consent withdrawal, profile
  // suspension and parent-side revocation take effect without client
  // cooperation (platform-auth.md: server invalidation is authoritative).
  const childRows = await db
    .select()
    .from(schema.children)
    .where(and(eq(schema.children.id, grant.childId), eq(schema.children.parentId, grant.parentId)))
    .limit(1);
  const child = childRows[0];
  if (!child || child.status !== "active") {
    throw new ApiError("AUTH_REQUIRED", "Sesi berakhir. Silakan masuk lagi.");
  }

  const parentRows = await db.select().from(schema.parents).where(eq(schema.parents.id, grant.parentId)).limit(1);
  const parent = parentRows[0];
  if (!parent) throw new ApiError("AUTH_REQUIRED", "Sesi berakhir. Silakan masuk lagi.");

  const familyRecords = await db
    .select({ action: schema.consentRecords.action, assuranceMethod: schema.consentRecords.assuranceMethod })
    .from(schema.consentRecords)
    .where(and(eq(schema.consentRecords.parentId, parent.id), isNull(schema.consentRecords.childId)))
    .orderBy(sql`${schema.consentRecords.recordedAt} desc`)
    .limit(1);
  const familyConsent: "granted" | "withdrawn" | "none" =
    familyRecords[0]?.action === "grant" ? "granted" : familyRecords[0]?.action === "withdraw" ? "withdrawn" : "none";
  if (familyConsent !== "granted") {
    throw new ApiError("CONSENT_REQUIRED", "Persetujuan orang tua diperlukan.");
  }
  const childRecords = await db
    .select({ action: schema.consentRecords.action })
    .from(schema.consentRecords)
    .where(and(eq(schema.consentRecords.parentId, parent.id), eq(schema.consentRecords.childId, child.id)))
    .orderBy(sql`${schema.consentRecords.recordedAt} desc`)
    .limit(1);
  if (childRecords.length > 0 && childRecords[0]!.action === "withdraw") {
    throw new ApiError("CONSENT_REQUIRED", "Persetujuan untuk profil ini telah ditarik.");
  }

  // ChildContext with a grant-scoped controls view: the auth session id is
  // the grant id (no browser session exists on this transport).
  const controls = {
    authSessionId: `kids-grant:${grant.id}`,
    parentId: parent.id,
    mode: "child" as const,
    activeChildId: child.id,
    adultGateUntil: null,
    lastVerifiedAt: null,
    revokedAt: null,
  };

  return {
    authSessionId: controls.authSessionId,
    authUserId: parent.authUserId,
    emailVerified: true,
    parent,
    controls,
    familyConsent,
    childConsentEffective: true,
    child,
  } as unknown as ChildContext;
}

/** Parent logout / session revocation kills every live grant they approved. */
export async function revokeGrantsForAuthUser(db: Database, authUserId: string): Promise<number> {
  const parentRows = await db.select({ id: schema.parents.id }).from(schema.parents).where(eq(schema.parents.authUserId, authUserId)).limit(1);
  if (parentRows.length === 0) return 0;
  return revokeGrantsForParent(db, parentRows[0]!.id, "parent_session_ended");
}

export async function revokeGrantsForParent(db: Database, parentId: string, reason: string): Promise<number> {
  const revoked = await db
    .update(schema.kidsGrants)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(schema.kidsGrants.parentId, parentId), isNull(schema.kidsGrants.revokedAt)))
    .returning({ id: schema.kidsGrants.id });
  return revoked.length;
}
