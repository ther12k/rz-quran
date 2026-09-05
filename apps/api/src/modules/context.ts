// Request context resolution and capability policies (docs/05 §2).
//
// Every domain route derives identity from the server session, never from a
// client-supplied parent/child id. Capability predicates:
//   adult_session : valid auth session + verified adult account
//   parent_gate   : adult_session + mode=parent + live 5-minute gate
//   child_session : adult_session + mode=child + owned active child + consent
import { and, desc, eq, isNull } from "drizzle-orm";
import { schema, type Database } from "@rzq/database";
import type { Auth } from "../auth.ts";
import { ApiError } from "../errors.ts";
import type { ConsentPolicy } from "../env.ts";

export type RequestContext = {
  authSessionId: string;
  authUserId: string;
  emailVerified: boolean;
  parent: typeof schema.parents.$inferSelect;
  controls: typeof schema.sessionControls.$inferSelect;
  /** Latest effective family consent state. */
  familyConsent: "granted" | "withdrawn" | "none";
  /** Family grant plus no child-scoped withdrawal for the active child. */
  childConsentEffective: boolean;
};

type AuthSession = { session: { id: string; userId: string; expiresAt: Date }; user: { id: string; emailVerified: boolean } };

export async function resolveContext(
  auth: Auth,
  db: Database,
  request: Request,
): Promise<RequestContext | null> {
  // Validate the session through the auth library (expiry, revocation).
  let sessionData: AuthSession | null = null;
  try {
    sessionData = (await auth.api.getSession({ headers: request.headers })) as AuthSession | null;
  } catch {
    sessionData = null;
  }
  if (!sessionData?.session) return null;

  const authUserId = sessionData.user.id;
  const authSessionId = sessionData.session.id;

  // Parent row is created lazily on first authenticated request; the consent
  // state machine governs whether any child data may exist.
  let parentRows = await db.select().from(schema.parents).where(eq(schema.parents.authUserId, authUserId)).limit(1);
  if (parentRows.length === 0) {
    const inserted = await db
      .insert(schema.parents)
      .values({ id: crypto.randomUUID(), authUserId, eligibilityStatus: "pending" })
      .onConflictDoNothing()
      .returning();
    parentRows = inserted.length
      ? inserted
      : await db.select().from(schema.parents).where(eq(schema.parents.authUserId, authUserId)).limit(1);
  }
  const parent = parentRows[0]!;

  let controlRows = await db
    .select()
    .from(schema.sessionControls)
    .where(eq(schema.sessionControls.authSessionId, authSessionId))
    .limit(1);
  if (controlRows.length === 0) {
    const inserted = await db
      .insert(schema.sessionControls)
      .values({ authSessionId, parentId: parent.id, mode: "parent" })
      .onConflictDoNothing()
      .returning();
    controlRows = inserted.length
      ? inserted
      : await db
          .select()
          .from(schema.sessionControls)
          .where(eq(schema.sessionControls.authSessionId, authSessionId))
          .limit(1);
  }
  const controls = controlRows[0]!;

  // Effective consent: latest family-scoped record wins.
  const familyRecords = await db
    .select({ action: schema.consentRecords.action })
    .from(schema.consentRecords)
    .where(and(eq(schema.consentRecords.parentId, parent.id), isNull(schema.consentRecords.childId)))
    .orderBy(desc(schema.consentRecords.recordedAt))
    .limit(1);
  const familyAction = familyRecords[0]?.action;
  const familyConsent: "granted" | "withdrawn" | "none" =
    familyAction === "grant" ? "granted" : familyAction === "withdraw" ? "withdrawn" : "none";

  let childConsentEffective = familyConsent === "granted";
  if (childConsentEffective && controls.activeChildId) {
    const childRecords = await db
      .select({ action: schema.consentRecords.action })
      .from(schema.consentRecords)
      .where(and(eq(schema.consentRecords.parentId, parent.id), eq(schema.consentRecords.childId, controls.activeChildId)))
      .orderBy(desc(schema.consentRecords.recordedAt))
      .limit(1);
    if (childRecords.length > 0 && childRecords[0]!.action === "withdraw") {
      childConsentEffective = false;
    }
  }

  return {
    authSessionId,
    authUserId,
    emailVerified: sessionData.user.emailVerified,
    parent,
    controls,
    familyConsent,
    childConsentEffective,
  };
}

export function requireAdultSession(ctx: RequestContext | null): RequestContext {
  if (!ctx) throw new ApiError("AUTH_REQUIRED", "Sesi berakhir. Silakan masuk lagi.");
  if (!ctx.emailVerified) {
    // Still an authenticated adult; onboarding shows verification state.
    return ctx;
  }
  return ctx;
}

export function requireParentGate(ctx: RequestContext | null): RequestContext {
  const c = requireAdultSession(ctx);
  if (c.controls.mode !== "parent") {
    throw new ApiError("PARENT_GATE_REQUIRED", "Area ini hanya untuk orang tua.");
  }
  if (!c.controls.adultGateUntil || c.controls.adultGateUntil.getTime() <= Date.now()) {
    throw new ApiError("PARENT_GATE_REQUIRED", "Area orang tua terkunci kembali. Silakan masuk lagi.");
  }
  return c;
}

export type ChildContext = RequestContext & {
  child: typeof schema.children.$inferSelect;
};

export async function requireChildSessionDb(
  auth: Auth,
  db: Database,
  request: Request,
): Promise<ChildContext> {
  const ctx = await resolveContext(auth, db, request);
  if (!ctx) throw new ApiError("AUTH_REQUIRED", "Sesi berakhir. Silakan masuk lagi.");
  if (ctx.controls.mode !== "child" || !ctx.controls.activeChildId) {
    throw new ApiError("AUTH_REQUIRED", "Sesi anak belum aktif.");
  }
  if (!ctx.emailVerified) throw new ApiError("AUTH_REQUIRED", "Sesi berakhir. Silakan masuk lagi.");
  if (!ctx.childConsentEffective) {
    throw new ApiError("CONSENT_REQUIRED", "Persetujuan orang tua diperlukan.");
  }
  const childRows = await db
    .select()
    .from(schema.children)
    .where(and(eq(schema.children.id, ctx.controls.activeChildId), eq(schema.children.parentId, ctx.parent.id)))
    .limit(1);
  const child = childRows[0];
  if (!child || child.status !== "active") {
    throw new ApiError("CONSENT_REQUIRED", "Profil anak tidak tersedia.");
  }
  return { ...ctx, child };
}

export type AppBindings = {
  auth: Auth;
  db: Database;
  consentPolicy: ConsentPolicy;
  requestId: string;
};
