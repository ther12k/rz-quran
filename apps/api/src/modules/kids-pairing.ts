// Staging-only native pairing module (GDM-009).
//
// Verifier-bound pairing (S256), allowlisted parent approval, one-use grant
// redemption. Mounted for all environments but every route refuses in
// production or when KIDS_PAIRING_ENABLED is off (GDM-004 P1/P3: production
// must neither issue grants nor accept their audience; boot also fails on the
// flag there — see env.ts).
//
// Limits are the initial engineering values from the GDM-004 threat review:
//   pairing TTL 5 min · human code 8 chars (unambiguous alphabet, hashed at
//   rest) · poll interval 5 s · code-entry failures 5/min per parent+source ·
//   bounded per-pairing attempts (8) · grant TTL 15 min · one-use redemption.
import { randomBytes } from "node:crypto";
import { Elysia } from "elysia";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { schema, type Database } from "@rzq/database";
import {
  kidsPairingApproveStrictSchema,
  kidsPairingCreateStrictSchema,
  kidsPairingTokenStrictSchema,
} from "@rzq/contracts";
import { ApiError } from "../errors.ts";
import { resolveContext, requireParentGate, type AppBindings } from "./context.ts";
import { KIDS_GRANT_AUDIENCE, resolveLiveGrant, sha256Base64Url, sha256Hex } from "../kids-grant.ts";

const PAIRING_TTL_MS = 5 * 60 * 1000;
const GRANT_TTL_S = 15 * 60;
const POLL_INTERVAL_S = 5;
const POLL_WINDOW_MS = POLL_INTERVAL_S * 1000;
const MAX_POLLS_PER_PAIRING_WINDOW = 3;
const SOURCE_WINDOW_MS = 30 * 1000;
const MAX_POLLS_PER_SOURCE_WINDOW = 30;
const CODE_FAIL_WINDOW_MS = 60 * 1000;
const MAX_CODE_FAILURES_PER_MIN = 5;
const MAX_PAIRING_ATTEMPTS = 8;
// A-Z minus I/O plus 2-9: no visually ambiguous glyphs.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEMO_ASSURANCE_METHOD = "demo_local_nonproduction";

function moduleGate(b: AppBindings) {
  if (!b.env.kidsPairingEnabled || b.env.appEnv === "production") {
    throw new ApiError("NOT_FOUND", "Permintaan tidak dikenal.");
  }
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function generateHumanCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return code;
}

/** sha256 of the network source; the raw address is never stored. */
async function sourceHashOf(request: Request): Promise<string> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return sha256Hex(ip);
}

type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

async function countAttempts(
  db: DbOrTx,
  where: { sourceHash?: string; pairingId?: string; kind: "poll" | "code_entry"; accepted?: boolean; sinceMs: number },
): Promise<number> {
  const conditions = [eq(schema.kidsPairingAttempts.kind, where.kind), gt(schema.kidsPairingAttempts.createdAt, new Date(Date.now() - where.sinceMs))];
  if (where.sourceHash !== undefined) conditions.push(eq(schema.kidsPairingAttempts.sourceHash, where.sourceHash));
  if (where.pairingId !== undefined) conditions.push(eq(schema.kidsPairingAttempts.pairingId, where.pairingId));
  if (where.accepted !== undefined) conditions.push(eq(schema.kidsPairingAttempts.accepted, where.accepted));
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.kidsPairingAttempts)
    .where(and(...conditions));
  return rows[0]?.count ?? 0;
}

function rateLimited(retryAfterSeconds: number): ApiError {
  return new ApiError("RATE_LIMITED", "Terlalu banyak percobaan. Tunggu sebentar.", {
    retry_after_seconds: retryAfterSeconds,
  });
}

export function kidsPairingModule(bindings: () => AppBindings) {
  return new Elysia({ prefix: "/api/v1" })
    // Native → server: create a verifier-bound pairing.
    .post("/kids/pairings", async ({ request, set, body }) => {
      const b = bindings();
      moduleGate(b);
      const parsed = kidsPairingCreateStrictSchema.safeParse(body);
      if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Permintaan tidak valid.");

      const code = generateHumanCode();
      const inserted = await b.db
        .insert(schema.kidsPairings)
        .values({
          id: crypto.randomUUID(),
          codeHash: await sha256Hex(code),
          codeChallenge: parsed.data.code_challenge,
          status: "pending",
          clientBuildId: parsed.data.client_build_id ?? null,
          expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
        })
        .returning();
      const pairing = inserted[0]!;

      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return {
        pairing_id: pairing.id,
        human_code: code,
        expires_at: pairing.expiresAt.toISOString(),
        poll_interval_seconds: POLL_INTERVAL_S,
      };
    })

    // Native → server: bounded poll / one-use redemption with S256 proof.
    .post("/kids/pairings/token", async ({ request, set, body }) => {
      const b = bindings();
      moduleGate(b);
      const parsed = kidsPairingTokenStrictSchema.safeParse(body);
      if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Permintaan tidak valid.");

      const sourceHash = await sourceHashOf(request);
      // Network-level flood guard covers every poll; the per-pairing window
      // (checked inside the transaction) counts only verifier-correct polls —
      // wrong verifiers are bounded by the pairing-wide attempt cap instead.
      if ((await countAttempts(b.db, { sourceHash, kind: "poll", sinceMs: SOURCE_WINDOW_MS })) >= MAX_POLLS_PER_SOURCE_WINDOW) {
        throw rateLimited(30);
      }

      // Verification happens before any sensitive lookup/return.
      const challenge = await sha256Base64Url(parsed.data.code_verifier);

      const outcome = await b.db.transaction(async (tx) => {
        const locked = await tx
          .select()
          .from(schema.kidsPairings)
          .where(eq(schema.kidsPairings.id, parsed.data.pairing_id))
          .for("update")
          .limit(1);
        const pairing = locked[0];
        if (!pairing) {
          await tx.insert(schema.kidsPairingAttempts).values({
            id: crypto.randomUUID(),
            pairingId: null,
            sourceHash,
            kind: "poll" as const,
            accepted: false,
          });
          return { error: new ApiError("NOT_FOUND", "Penautan tidak ditemukan.") };
        }

        const expired = pairing.expiresAt.getTime() <= Date.now();
        const verifierOk = pairing.codeChallenge === challenge;
        await tx.insert(schema.kidsPairingAttempts).values({
          id: crypto.randomUUID(),
          pairingId: pairing.id,
          sourceHash,
          kind: "poll" as const,
          accepted: verifierOk,
        });

        if (!verifierOk) {
          // Wrong verifier: bump the bounded pairing-wide counter.
          const nextCount = pairing.attemptCount + 1;
          const deniedNow = nextCount >= MAX_PAIRING_ATTEMPTS;
          await tx
            .update(schema.kidsPairings)
            .set({ attemptCount: nextCount, ...(deniedNow ? { status: "denied" as const, decidedAt: new Date() } : {}) })
            .where(eq(schema.kidsPairings.id, pairing.id));
          return { error: new ApiError("PAIRING_INVALID", "Penautan tidak valid. Buat penautan baru.") };
        }
        // Strictly greater: the count includes this poll's own row, so the
        // window admits MAX correct polls and throttles the next one.
        if (
          (await countAttempts(tx, {
            pairingId: pairing.id,
            kind: "poll",
            accepted: true,
            sinceMs: POLL_WINDOW_MS,
          })) > MAX_POLLS_PER_PAIRING_WINDOW
        ) {
          return { error: rateLimited(POLL_INTERVAL_S) };
        }

        if (expired) return { response: { status: "expired" as const } };
        if (pairing.status === "pending") return { response: { status: "pending" as const } };
        if (pairing.status === "denied") return { response: { status: "denied" as const } };
        if (pairing.status === "redeemed") {
          // One-use redemption: a lost response means the client starts a new
          // pairing; a second token is never issued for the same pairing.
          return { error: new ApiError("PAIRING_INVALID", "Penautan tidak valid. Buat penautan baru.") };
        }

        // status === approved: redeem exactly once and supersede any older
        // live grant for the child (the partial unique index backs this up).
        await tx
          .update(schema.kidsGrants)
          .set({ revokedAt: new Date(), revokedReason: "superseded" })
          .where(and(eq(schema.kidsGrants.childId, pairing.approvedChildId!), isNull(schema.kidsGrants.revokedAt)));
        await tx.update(schema.kidsPairings).set({ status: "redeemed", redeemedAt: new Date() }).where(eq(schema.kidsPairings.id, pairing.id));

        const token = base64url(randomBytes(32));
        const allowlistRows = await tx
          .select({ id: schema.lessonVersions.id })
          .from(schema.lessonVersions)
          .where(and(eq(schema.lessonVersions.demoOnly, true), eq(schema.lessonVersions.status, "published")));
        await tx.insert(schema.kidsGrants).values({
          id: crypto.randomUUID(),
          pairingId: pairing.id,
          childId: pairing.approvedChildId!,
          parentId: pairing.approvedByParentId!,
          tokenHash: await sha256Hex(token),
          audience: KIDS_GRANT_AUDIENCE,
          mintedEnv: b.env.appEnv as "development" | "test" | "staging",
          lessonAllowlist: allowlistRows.map((r) => r.id),
          clientBuildId: pairing.clientBuildId,
          expiresAt: new Date(Date.now() + GRANT_TTL_S * 1000),
        });

        const childRows = await tx.select().from(schema.children).where(eq(schema.children.id, pairing.approvedChildId!)).limit(1);
        return {
          response: {
            status: "approved" as const,
            access_token: token,
            token_type: "Bearer" as const,
            expires_in: GRANT_TTL_S,
            audience: KIDS_GRANT_AUDIENCE,
            profile: { id: childRows[0]!.id, nickname: childRows[0]!.nickname },
            lesson_allowlist: allowlistRows.map((r) => r.id),
            client_build_id: pairing.clientBuildId,
          },
        };
      });

      if (outcome.error) throw outcome.error;
      set.headers["Cache-Control"] = "no-store";
      return outcome.response;
    })

    // Parent (web) → server: approve or deny a pairing with the human code.
    .post("/parent/kids/pairings/approve", async ({ request, set, body }) => {
      const b = bindings();
      moduleGate(b);
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const parsed = kidsPairingApproveStrictSchema.safeParse(body);
      if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Permintaan tidak valid.");

      // Allowlisted staging parents only (GDM-004: protected approval).
      const userRows = await b.db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, ctx.authUserId)).limit(1);
      const email = userRows[0]?.email?.toLowerCase() ?? "";
      if (!b.env.kidsPairingParentAllowlist.includes(email)) {
        throw new ApiError("CAPABILITY_REQUIRED", "Akun ini tidak diizinkan menyetujui penautan staging.");
      }

      const sourceHash = await sourceHashOf(request);
      const recentFailures = await countAttempts(b.db, {
        sourceHash,
        kind: "code_entry",
        accepted: false,
        sinceMs: CODE_FAIL_WINDOW_MS,
      });
      if (recentFailures >= MAX_CODE_FAILURES_PER_MIN) {
        throw rateLimited(60);
      }

      const codeHash = await sha256Hex(parsed.data.code);
      const outcome = await b.db.transaction(async (tx) => {
        const locked = await tx
          .select()
          .from(schema.kidsPairings)
          .where(eq(schema.kidsPairings.id, parsed.data.pairing_id))
          .for("update")
          .limit(1);
        const pairing = locked[0];
        const recordAttempt = (accepted: boolean) =>
          tx.insert(schema.kidsPairingAttempts).values({
            id: crypto.randomUUID(),
            pairingId: pairing?.id ?? null,
            sourceHash,
            kind: "code_entry" as const,
            accepted,
          });

        if (!pairing || pairing.status !== "pending" || pairing.expiresAt.getTime() <= Date.now()) {
          await recordAttempt(false);
          return { error: new ApiError("NOT_FOUND", "Penautan tidak ditemukan atau sudah berakhir.") };
        }
        if (pairing.codeHash !== codeHash) {
          // Bounded pairing-wide attempts; auto-deny at the cap.
          const nextCount = pairing.attemptCount + 1;
          const deny = nextCount >= MAX_PAIRING_ATTEMPTS;
          await tx
            .update(schema.kidsPairings)
            .set({ attemptCount: nextCount, ...(deny ? { status: "denied" as const, decidedAt: new Date() } : {}) })
            .where(eq(schema.kidsPairings.id, pairing.id));
          await recordAttempt(false);
          return { error: new ApiError("PAIRING_INVALID", "Kode tidak valid.") };
        }

        if (parsed.data.decision === "deny") {
          await tx.update(schema.kidsPairings).set({ status: "denied", decidedAt: new Date() }).where(eq(schema.kidsPairings.id, pairing.id));
          await recordAttempt(true);
          return { response: { status: "denied" as const, profile: null, grant_audience: null } };
        }

        // Approve: owned, active, synthetic-only (demo-assured) profile with
        // effective consent. Staging pairing never touches real profiles.
        const childRows = await tx
          .select()
          .from(schema.children)
          .where(and(eq(schema.children.id, parsed.data.child_id), eq(schema.children.parentId, ctx.parent.id)))
          .limit(1);
        const child = childRows[0];
        if (!child || child.status !== "active") {
          await recordAttempt(false);
          return { error: new ApiError("NOT_FOUND", "Profil tidak ditemukan.") };
        }
        const familyRecords = await tx
          .select({ action: schema.consentRecords.action, assuranceMethod: schema.consentRecords.assuranceMethod })
          .from(schema.consentRecords)
          .where(and(eq(schema.consentRecords.parentId, ctx.parent.id), isNull(schema.consentRecords.childId)))
          .orderBy(sql`${schema.consentRecords.recordedAt} desc`)
          .limit(1);
        const family = familyRecords[0];
        if (family?.action !== "grant" || family.assuranceMethod !== DEMO_ASSURANCE_METHOD) {
          await recordAttempt(false);
          return {
            error: new ApiError(
              "CAPABILITY_REQUIRED",
              "Penautan staging hanya untuk profil demo (bukan profil nyata).",
            ),
          };
        }

        await tx
          .update(schema.kidsPairings)
          .set({
            status: "approved",
            approvedChildId: child.id,
            approvedByParentId: ctx.parent.id,
            decidedAt: new Date(),
          })
          .where(eq(schema.kidsPairings.id, pairing.id));
        await recordAttempt(true);
        return {
          response: {
            status: "approved" as const,
            profile: { id: child.id, nickname: child.nickname },
            grant_audience: KIDS_GRANT_AUDIENCE,
          },
        };
      });

      if (outcome.error) throw outcome.error;
      set.headers["Cache-Control"] = "no-store";
      return outcome.response;
    })

    // Native → server: best-effort revocation at logout (platform-auth §6:
    // "Logout clears local memory and attempts server revocation"). Requires
    // a currently valid grant; server expiry/parent revocation stay
    // authoritative independently of client cooperation.
    .post("/kids/grants/revoke_current", async ({ request, set }) => {
      const b = bindings();
      moduleGate(b);
      const grant = await resolveLiveGrant(b.db, request, b.env);
      await b.db
        .update(schema.kidsGrants)
        .set({ revokedAt: new Date(), revokedReason: "client_logout" })
        .where(and(eq(schema.kidsGrants.id, grant.id), isNull(schema.kidsGrants.revokedAt)));
      set.headers["Cache-Control"] = "no-store";
      return { revoked: true };
    })

    // Parent → server: revoke every live grant (logout hygiene, P5).
    .post("/parent/kids/pairings/revoke", async ({ request, set }) => {
      const b = bindings();
      moduleGate(b);
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));

      const revoked = await b.db
        .update(schema.kidsGrants)
        .set({ revokedAt: new Date(), revokedReason: "parent_revoked" })
        .where(and(eq(schema.kidsGrants.parentId, ctx.parent.id), isNull(schema.kidsGrants.revokedAt)))
        .returning({ id: schema.kidsGrants.id });

      set.headers["Cache-Control"] = "no-store";
      return { revoked_grants: revoked.length };
    });
}

