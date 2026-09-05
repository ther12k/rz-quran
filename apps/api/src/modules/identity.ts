// Identity module: /me, parent gate unlock/lock, and the guarded Better Auth
// mount with the child-mode route allowlist (T013/T014).
import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { schema } from "@rzq/database";
import { gateRequestSchema } from "@rzq/contracts";
import { ApiError } from "../errors.ts";
import { resolveContext, requireAdultSession, type AppBindings } from "./context.ts";
import { verifyPasswordForUser } from "../auth.ts";

export const GATE_DURATION_MS = 5 * 60 * 1000;

// Child-mode allowlist for mounted auth routes. Recovery/sign-out and
// verification reads are safe; account/session/email mutation requires the
// adult gate and is therefore denied while a child is active.
const CHILD_MODE_AUTH_ALLOWLIST: { method: string; pattern: RegExp }[] = [
  { method: "GET", pattern: /^\/api\/auth\/get-session$/ },
  { method: "POST", pattern: /^\/api\/auth\/sign-out$/ },
  { method: "GET", pattern: /^\/api\/auth\/verify-email$/ },
];

function authRouteAllowedInChildMode(method: string, path: string): boolean {
  return CHILD_MODE_AUTH_ALLOWLIST.some((e) => e.method === method && e.pattern.test(path));
}

export function identityModule(bindings: () => AppBindings) {
  return new Elysia({ prefix: "/api" })
    .get("/auth/*", async ({ request, set }) => {
      const { auth } = bindings();
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/api/auth";
      const method = request.method.toUpperCase();

      // Child-mode guard BEFORE the mounted handler (docs/03 §5).
      const ctx = await resolveContext(auth, bindings().db, request);
      if (ctx && ctx.controls.mode === "child" && !authRouteAllowedInChildMode(method, path)) {
        set.status = 403;
        return {
          error: {
            code: "PARENT_GATE_REQUIRED",
            message: "Area ini hanya untuk orang tua.",
            request_id: bindings().requestId,
          },
        };
      }

      const webHandler = auth.handler;
      return webHandler(request);
    })
    .get("/v1/me", async ({ request, set }) => {
      const b = bindings();
      const ctx = await resolveContext(b.auth, b.db, request);
      if (!ctx) {
        set.status = 401;
        return {
          error: { code: "AUTH_REQUIRED", message: "Sesi berakhir. Silakan masuk lagi.", request_id: b.requestId },
        };
      }
      set.headers["Cache-Control"] = "no-store";
      const staffRows = await b.db
        .select({ capabilities: schema.staffMembers.capabilities })
        .from(schema.staffMembers)
        .where(eq(schema.staffMembers.authUserId, ctx.authUserId))
        .limit(1);
      let nickname: string | null = null;
      if (ctx.controls.mode === "child" && ctx.controls.activeChildId) {
        const rows = await b.db
          .select({ nickname: schema.children.nickname })
          .from(schema.children)
          .where(eq(schema.children.id, ctx.controls.activeChildId))
          .limit(1);
        nickname = rows[0]?.nickname ?? null;
      }
      return {
        mode: ctx.controls.mode,
        email_verified: ctx.emailVerified,
        parent_gate_until: ctx.controls.adultGateUntil?.toISOString() ?? null,
        active_child_id: ctx.controls.activeChildId,
        active_child_nickname: nickname,
        eligibility_status: ctx.parent.eligibilityStatus,
        effective_consent: ctx.familyConsent === "granted",
        staff_capabilities: staffRows[0]?.capabilities ?? [],
      };
    })
    .post("/v1/parent/gate", async ({ request, set, body }) => {
      const b = bindings();
      const parsed = gateRequestSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return {
          error: {
            code: "VALIDATION_ERROR",
            message: "Permintaan tidak valid.",
            request_id: b.requestId,
            details: parsed.error.flatten(),
          },
        };
      }
      const ctx = await resolveContext(b.auth, b.db, request);
      if (!ctx) {
        set.status = 401;
        return {
          error: { code: "AUTH_REQUIRED", message: "Sesi berakhir. Silakan masuk lagi.", request_id: b.requestId },
        };
      }
      if (ctx.controls.mode !== "parent") {
        set.status = 403;
        return {
          error: {
            code: "PARENT_GATE_REQUIRED",
            message: "Area ini hanya untuk orang tua.",
            request_id: b.requestId,
          },
        };
      }
      const ok = await verifyPasswordForUser(b.auth, b.db, ctx.authUserId, parsed.data.password);
      if (!ok) {
        set.status = 401;
        return {
          error: {
            code: "AUTH_REQUIRED",
            message: "Belum berhasil. Periksa kata sandi dan coba lagi.",
            request_id: b.requestId,
          },
        };
      }
      const until = new Date(Date.now() + GATE_DURATION_MS);
      await b.db
        .update(schema.sessionControls)
        .set({ adultGateUntil: until, lastVerifiedAt: new Date() })
        .where(eq(schema.sessionControls.authSessionId, ctx.authSessionId));
      set.headers["Cache-Control"] = "no-store";
      return {
        mode: ctx.controls.mode,
        email_verified: ctx.emailVerified,
        parent_gate_until: until.toISOString(),
        active_child_id: ctx.controls.activeChildId,
        active_child_nickname: null,
        eligibility_status: ctx.parent.eligibilityStatus,
        effective_consent: ctx.familyConsent === "granted",
        staff_capabilities: [],
      };
    })
    .delete("/v1/parent/gate", async ({ request, set }) => {
      const b = bindings();
      const ctx = await resolveContext(b.auth, b.db, request);
      if (!ctx) {
        set.status = 401;
        return {
          error: { code: "AUTH_REQUIRED", message: "Sesi berakhir. Silakan masuk lagi.", request_id: b.requestId },
        };
      }
      await b.db
        .update(schema.sessionControls)
        .set({ adultGateUntil: null })
        .where(eq(schema.sessionControls.authSessionId, ctx.authSessionId));
      set.headers["Cache-Control"] = "no-store";
      return {
        mode: ctx.controls.mode,
        email_verified: ctx.emailVerified,
        parent_gate_until: null,
        active_child_id: ctx.controls.activeChildId,
        active_child_nickname: null,
        eligibility_status: ctx.parent.eligibilityStatus,
        effective_consent: ctx.familyConsent === "granted",
        staff_capabilities: [],
      };
    });
}

// MeDTO builder shared with /me child nickname resolution.
export async function buildMe(bindings: AppBindings, request: Request) {
  const b = bindings;
  const ctx = await resolveContext(b.auth, b.db, request);
  requireAdultSession(ctx);
  let nickname: string | null = null;
  if (ctx?.controls.mode === "child" && ctx.controls.activeChildId) {
    const rows = await b.db
      .select({ nickname: schema.children.nickname })
      .from(schema.children)
      .where(eq(schema.children.id, ctx.controls.activeChildId))
      .limit(1);
    nickname = rows[0]?.nickname ?? null;
  }
  return {
    mode: ctx!.controls.mode,
    email_verified: ctx!.emailVerified,
    parent_gate_until: ctx!.controls.adultGateUntil?.toISOString() ?? null,
    active_child_id: ctx!.controls.activeChildId,
    active_child_nickname: nickname,
    eligibility_status: ctx!.parent.eligibilityStatus,
    effective_consent: ctx!.familyConsent === "granted",
    staff_capabilities: [] as string[],
  };
}
