// Families module: consent state machine (T015), child profiles (T016),
// mode switching (T017). All routes derive ownership from server context.
import { Elysia } from "elysia";
import { and, eq, sql } from "drizzle-orm";
import { schema } from "@rzq/database";
import { childCreateSchema, childPatchSchema, consentRequestSchema } from "@rzq/contracts";
import { ApiError } from "../errors.ts";
import { resolveContext, requireParentGate, type AppBindings } from "./context.ts";
import { withIdempotency } from "../idempotency.ts";

export const DEMO_NOTICE_VERSION = "demo-notice-1";
export const DEMO_POLICY_VERSION = "demo-policy-1";
const DEMO_ASSURANCE_TOKEN = "demo-local-assurance";

function childDto(row: typeof schema.children.$inferSelect) {
  return {
    id: row.id,
    nickname: row.nickname,
    avatar_key: row.avatarKey,
    age_band: row.ageBand,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  };
}

export function familiesModule(bindings: () => AppBindings) {
  return new Elysia({ prefix: "/api/v1" })
    .post("/parent/consents", async ({ request, set, body }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const parsed = consentRequestSchema.safeParse(body);
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
      const input = parsed.data;

      // Scope-child consent requires an owned child.
      if (input.scope === "child" && input.child_id) {
        const owned = await b.db
          .select({ id: schema.children.id })
          .from(schema.children)
          .where(and(eq(schema.children.id, input.child_id), eq(schema.children.parentId, ctx.parent.id)))
          .limit(1);
        if (owned.length === 0) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");
      }

      let assuranceMethod: string | null = null;
      let assuranceReference: string | null = null;
      if (input.action === "grant") {
        const policy = b.consentPolicy;
        if (policy.kind === "blocked") {
          throw new ApiError(
            "ELIGIBILITY_BLOCKED",
            "Persetujuan belum dapat dicatat: kebijakan produksi belum disetujui.",
          );
        }
        if (policy.kind === "demo") {
          if (input.notice_version !== DEMO_NOTICE_VERSION || input.policy_version !== DEMO_POLICY_VERSION) {
            throw new ApiError("VALIDATION_ERROR", "Versi pemberitahuan tidak dikenal.");
          }
          if (input.assurance_token !== DEMO_ASSURANCE_TOKEN) {
            throw new ApiError("ELIGIBILITY_BLOCKED", "Verifikasi persetujuan demo tidak valid.");
          }
          assuranceMethod = "demo_local_nonproduction";
          assuranceReference = "demo://assurance/local";
        } else {
          // Production assurance adapter is intentionally unimplemented until
          // an approved method exists (D03); fail closed.
          throw new ApiError("ELIGIBILITY_BLOCKED", "Metode persetujuan produksi belum dikonfigurasi.");
        }
      }

      const recordId = crypto.randomUUID();
      const inserted = await b.db
        .insert(schema.consentRecords)
        .values({
          id: recordId,
          parentId: ctx.parent.id,
          childId: input.child_id,
          scope: input.scope,
          purpose: "profile_learning",
          action: input.action,
          noticeVersion: input.notice_version,
          policyVersion: input.policy_version,
          assuranceMethod,
          assuranceEvidenceReference: assuranceReference,
        })
        .returning();
      const row = inserted[0]!;
      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return {
        id: row.id,
        action: row.action,
        scope: row.scope,
        child_id: row.childId,
        notice_version: row.noticeVersion,
        policy_version: row.policyVersion,
        recorded_at: row.recordedAt.toISOString(),
      };
    })
    .get("/parent/children", async ({ request, set }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const rows = await b.db
        .select()
        .from(schema.children)
        .where(eq(schema.children.parentId, ctx.parent.id));
      set.headers["Cache-Control"] = "no-store";
      return { items: rows.map(childDto), next_cursor: null };
    })
    .post("/parent/children", async ({ request, set, body }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const parsed = childCreateSchema.safeParse(body);
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
      const idemKey = request.headers.get("Idempotency-Key");
      const result = await withIdempotency({
        db: b.db,
        actorScope: `parent:${ctx.parent.id}`,
        parentId: ctx.parent.id,
        method: "POST",
        route: "/api/v1/parent/children",
        key: idemKey,
        requestBody: body,
        handler: async () => {
          // FR-01: unverified adult cannot create a child profile.
          if (!ctx.emailVerified) {
            throw new ApiError("ELIGIBILITY_BLOCKED", "Verifikasi email diperlukan sebelum membuat profil anak.");
          }
          if (ctx.familyConsent !== "granted") {
            throw new ApiError("CONSENT_REQUIRED", "Persetujuan orang tua diperlukan.");
          }
          const childId = crypto.randomUUID();
          // Race-safe three-profile limit: lock the parent row inside the tx.
          const created = await b.db.transaction(async (tx) => {
            await tx.execute(
              sql`select id from parents where id = ${ctx.parent.id} for update`,
            );
            const activeCount = await tx
              .select({ count: sql<number>`count(*)::int` })
              .from(schema.children)
              .where(and(eq(schema.children.parentId, ctx.parent.id), eq(schema.children.status, "active")));
            if ((activeCount[0]?.count ?? 0) >= 3) {
              throw new ApiError("VALIDATION_ERROR", "Maksimal tiga profil anak aktif.");
            }
            const rows = await tx
              .insert(schema.children)
              .values({
                id: childId,
                parentId: ctx.parent.id,
                nickname: parsed.data!.nickname,
                avatarKey: parsed.data!.avatar_key,
                ageBand: parsed.data!.age_band,
                timezone: ctx.parent.timezone,
              })
              .returning();
            return rows[0]!;
          });
          return { status: 201, body: childDto(created) };
        },
      });
      set.status = result.status;
      set.headers["Cache-Control"] = "no-store";
      return result.body;
    })
    .patch("/parent/children/:childId", async ({ request, set, body, params }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const parsed = childPatchSchema.safeParse(body);
      if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Permintaan tidak valid.");
      const rows = await b.db
        .update(schema.children)
        .set({
          ...(parsed.data.nickname !== undefined ? { nickname: parsed.data.nickname } : {}),
          ...(parsed.data.avatar_key !== undefined ? { avatarKey: parsed.data.avatar_key } : {}),
          ...(parsed.data.age_band !== undefined ? { ageBand: parsed.data.age_band } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.children.id, params.childId), eq(schema.children.parentId, ctx.parent.id)))
        .returning();
      if (rows.length === 0) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");
      set.headers["Cache-Control"] = "no-store";
      return childDto(rows[0]!);
    })
    .post("/parent/children/:childId/enter", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const rows = await b.db
        .select()
        .from(schema.children)
        .where(and(eq(schema.children.id, params.childId), eq(schema.children.parentId, ctx.parent.id)))
        .limit(1);
      const child = rows[0];
      if (!child || child.status !== "active") throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");
      if (ctx.familyConsent !== "granted") {
        throw new ApiError("CONSENT_REQUIRED", "Persetujuan orang tua diperlukan.");
      }
      // Child-scoped withdrawal for THIS child also blocks entry (latest wins).
      const childRecords = await b.db
        .select({ action: schema.consentRecords.action })
        .from(schema.consentRecords)
        .where(
          and(
            eq(schema.consentRecords.parentId, ctx.parent.id),
            eq(schema.consentRecords.childId, child.id),
          ),
        )
        .orderBy(sql`recorded_at desc`)
        .limit(1);
      if (childRecords.length > 0 && childRecords[0]!.action === "withdraw") {
        throw new ApiError("CONSENT_REQUIRED", "Persetujuan untuk profil ini telah ditarik.");
      }
      // Enter child mode: drop the adult gate in the same transaction.
      await b.db
        .update(schema.sessionControls)
        .set({ mode: "child", activeChildId: child.id, adultGateUntil: null })
        .where(eq(schema.sessionControls.authSessionId, ctx.authSessionId));
      set.status = 200;
      set.headers["Cache-Control"] = "no-store";
      return childDto(child);
    })
    .get("/parent/children/:childId/settings", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const rows = await b.db
        .select()
        .from(schema.children)
        .where(and(eq(schema.children.id, params.childId), eq(schema.children.parentId, ctx.parent.id)))
        .limit(1);
      const child = rows[0];
      if (!child) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");
      set.headers["Cache-Control"] = "no-store";
      return {
        session_goal_minutes: child.sessionGoalMinutes,
        quiet_celebrations: child.quietCelebrations,
        reduced_motion: child.reducedMotion,
        timezone: child.timezone,
      };
    })
    .put("/parent/children/:childId/settings", async ({ request, set, params, body }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const data = body as { session_goal_minutes?: number; quiet_celebrations?: boolean; reduced_motion?: boolean; timezone?: string };
      const updates: Partial<typeof schema.children.$inferInsert> = { updatedAt: new Date() };
      if (data.session_goal_minutes !== undefined) {
        if (![5, 10, 15].includes(data.session_goal_minutes)) {
          throw new ApiError("VALIDATION_ERROR", "Target sesi harus 5, 10, atau 15 menit.");
        }
        updates.sessionGoalMinutes = data.session_goal_minutes as 5 | 10 | 15;
      }
      if (data.quiet_celebrations !== undefined) updates.quietCelebrations = Boolean(data.quiet_celebrations);
      if (data.reduced_motion !== undefined) updates.reducedMotion = Boolean(data.reduced_motion);
      if (data.timezone !== undefined) updates.timezone = String(data.timezone);

      const rows = await b.db
        .update(schema.children)
        .set(updates)
        .where(and(eq(schema.children.id, params.childId), eq(schema.children.parentId, ctx.parent.id)))
        .returning();
      if (rows.length === 0) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");
      const c = rows[0]!;
      set.headers["Cache-Control"] = "no-store";
      return {
        session_goal_minutes: c.sessionGoalMinutes,
        quiet_celebrations: c.quietCelebrations,
        reduced_motion: c.reducedMotion,
        timezone: c.timezone,
      };
    })
    .get("/parent/children/:childId/assessments", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const child = await b.db
        .select({ id: schema.children.id })
        .from(schema.children)
        .where(and(eq(schema.children.id, params.childId), eq(schema.children.parentId, ctx.parent.id)))
        .limit(1);
      if (child.length === 0) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");

      const rows = await b.db
        .select()
        .from(schema.parentAssessments)
        .where(and(eq(schema.parentAssessments.childId, params.childId), eq(schema.parentAssessments.parentId, ctx.parent.id)))
        .orderBy(sql`observed_at desc`);

      set.headers["Cache-Control"] = "no-store";
      return {
        items: rows.map((r) => ({
          id: r.id,
          chapter_number: r.chapterNumber,
          status: r.status,
          observed_at: r.observedAt.toISOString(),
        })),
        next_cursor: null,
      };
    })
    .post("/parent/children/:childId/assessments", async ({ request, set, params, body }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const data = body as { chapter_number: number; status: "needs_practice" | "developing" | "parent_confirmed" };
      if (!data.chapter_number || data.chapter_number < 1 || data.chapter_number > 114) {
        throw new ApiError("VALIDATION_ERROR", "Nomor surat harus antara 1 dan 114.");
      }
      if (!["needs_practice", "developing", "parent_confirmed"].includes(data.status)) {
        throw new ApiError("VALIDATION_ERROR", "Status penilaian tidak valid.");
      }

      const child = await b.db
        .select({ id: schema.children.id })
        .from(schema.children)
        .where(and(eq(schema.children.id, params.childId), eq(schema.children.parentId, ctx.parent.id)))
        .limit(1);
      if (child.length === 0) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");

      const recordId = crypto.randomUUID();
      const inserted = await b.db
        .insert(schema.parentAssessments)
        .values({
          id: recordId,
          childId: params.childId,
          parentId: ctx.parent.id,
          chapterNumber: data.chapter_number,
          status: data.status,
          observedAt: new Date(),
        })
        .returning();

      const r = inserted[0]!;
      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return {
        id: r.id,
        chapter_number: r.chapterNumber,
        status: r.status,
        observed_at: r.observedAt.toISOString(),
      };
    })
    .post("/parent/children/:childId/stage-overrides", async ({ request, set, params, body }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const data = body as { lesson_id: string; reason: "parent_selected_start" | "guided_review" };
      if (!data.lesson_id || !data.reason) throw new ApiError("VALIDATION_ERROR", "Permintaan tidak valid.");

      const rows = await b.db
        .insert(schema.stageOverrides)
        .values({
          childId: params.childId,
          parentId: ctx.parent.id,
          lessonId: data.lesson_id,
          reason: data.reason,
          grantedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.stageOverrides.childId, schema.stageOverrides.lessonId],
          set: { reason: data.reason, revokedAt: null, grantedAt: new Date() },
        })
        .returning();
      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return {
        child_id: rows[0]!.childId,
        lesson_id: rows[0]!.lessonId,
        reason: rows[0]!.reason,
        granted_at: rows[0]!.grantedAt.toISOString(),
      };
    })
    .post("/parent/children/:childId/replace-session", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      await b.db
        .update(schema.learningSessions)
        .set({ status: "replaced" })
        .where(
          and(
            eq(schema.learningSessions.childId, params.childId),
            sql`status in ('active', 'paused')`,
          ),
        );
      set.headers["Cache-Control"] = "no-store";
      return { success: true };
    });
}
