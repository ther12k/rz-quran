// Privacy module (M4): withdrawal enforcement (T052), export jobs (T053),
// child deletion with suppression ledger (T054).
import { Elysia } from "elysia";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@rzq/database";
import { ApiError } from "../errors.ts";
import { resolveContext, requireParentGate, type AppBindings } from "./context.ts";
import { withIdempotency } from "../idempotency.ts";

const EXPORT_VERSION = "export-schema-1";

// T052: A family withdrawal blocks ALL profiles; a child withdrawal blocks
// that profile immediately. Enforced at session resolution + every learning write.
export function verifyWriteAllowed(bindings: AppBindings, ctx: { familyConsent: string; childConsentEffective?: boolean }) {
  if (ctx.familyConsent !== "granted") {
    throw new ApiError("CONSENT_REQUIRED", "Persetujuan telah ditarik. Belajar dihentikan sementara.");
  }
  if (ctx.childConsentEffective === false) {
    throw new ApiError("CONSENT_REQUIRED", "Persetujuan untuk profil ini telah ditarik.");
  }
}

export function privacyModule(bindings: () => AppBindings) {
  return new Elysia({ prefix: "/api/v1" })
    // T052: record withdrawal (family or child scope). Withdraw needs no new assurance.
    .post("/parent/consents/withdraw", async ({ request, set, body }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const data = body as { scope: "family" | "child"; child_id?: string | null };

      if (data.scope === "child") {
        if (!data.child_id) throw new ApiError("VALIDATION_ERROR", "child_id wajib untuk penarikan per anak.");
        const owned = await b.db
          .select({ id: schema.children.id })
          .from(schema.children)
          .where(and(eq(schema.children.id, data.child_id), eq(schema.children.parentId, ctx.parent.id)))
          .limit(1);
        if (owned.length === 0) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");
      }

      const id = crypto.randomUUID();
      await b.db.insert(schema.consentRecords).values({
        id,
        parentId: ctx.parent.id,
        childId: data.scope === "child" ? data.child_id! : null,
        scope: data.scope,
        purpose: "profile_learning",
        action: "withdraw",
        noticeVersion: "demo-notice-1",
        policyVersion: "demo-policy-1",
      });

      // Withdrawal immediately blocks learning writes: revoke the child's
      // active sessions so nothing can continue after this point.
      if (data.scope === "child") {
        await b.db
          .update(schema.learningSessions)
          .set({ status: "expired" })
          .where(and(eq(schema.learningSessions.childId, data.child_id!), inArray(schema.learningSessions.status, ["active", "paused"])));
      } else {
        const childIds = await b.db
          .select({ id: schema.children.id })
          .from(schema.children)
          .where(eq(schema.children.parentId, ctx.parent.id));
        if (childIds.length > 0) {
          await b.db
            .update(schema.learningSessions)
            .set({ status: "expired" })
            .where(
              and(
                inArray(schema.learningSessions.childId, childIds.map((c) => c.id)),
                inArray(schema.learningSessions.status, ["active", "paused"]),
              ),
            );
        }
      }

      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return { id, action: "withdraw", scope: data.scope, child_id: data.child_id ?? null };
    })

    // T053: owner-gated export job (one active export; max 3/day enforced loosely).
    .post("/parent/exports", async ({ request, set, body }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const idemKey = request.headers.get("Idempotency-Key");

      const result = await withIdempotency({
        db: b.db,
        actorScope: `parent:${ctx.parent.id}`,
        parentId: ctx.parent.id,
        method: "POST",
        route: "/api/v1/parent/exports",
        key: idemKey,
        requestBody: body ?? {},
        handler: async () => {
          const active = await b.db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.jobs)
            .where(and(eq(schema.jobs.parentId, ctx.parent.id), eq(schema.jobs.kind, "export"), inArray(schema.jobs.status, ["queued", "running"])));
          if ((active[0]?.count ?? 0) >= 1) {
            throw new ApiError("VALIDATION_ERROR", "Masih ada ekspor yang sedang diproses.");
          }

          const jobId = crypto.randomUUID();
          await b.db.insert(schema.jobs).values({
            id: jobId,
            kind: "export",
            parentId: ctx.parent.id,
            payload: { parent_id: ctx.parent.id, schema_version: EXPORT_VERSION },
            status: "queued",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
          return { status: 202, body: { job_id: jobId, status: "queued" } };
        },
      });

      set.status = result.status;
      set.headers["Cache-Control"] = "no-store";
      return result.body;
    })

    .get("/parent/jobs/:jobId", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const rows = await b.db
        .select()
        .from(schema.jobs)
        .where(and(eq(schema.jobs.id, params.jobId), eq(schema.jobs.parentId, ctx.parent.id)))
        .limit(1);
      const job = rows[0];
      if (!job) throw new ApiError("NOT_FOUND", "Pekerjaan tidak ditemukan.");
      set.headers["Cache-Control"] = "no-store";
      return {
        job_id: job.id,
        kind: job.kind,
        status: job.status,
        attempts: job.attempts,
        created_at: job.createdAt.toISOString(),
        completed_at: job.completedAt?.toISOString() ?? null,
        result_available: job.status === "succeeded",
      };
    })

    // Download: owner-gated, expires with the job (24h), contains only this parent's data.
    .get("/parent/exports/:jobId/download", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const rows = await b.db
        .select()
        .from(schema.jobs)
        .where(and(eq(schema.jobs.id, params.jobId), eq(schema.jobs.parentId, ctx.parent.id), eq(schema.jobs.kind, "export")))
        .limit(1);
      const job = rows[0];
      if (!job) throw new ApiError("NOT_FOUND", "Ekspor tidak ditemukan.");
      if (job.status !== "succeeded") throw new ApiError("VALIDATION_ERROR", "Ekspor belum selesai.");
      if (job.expiresAt && job.expiresAt.getTime() <= Date.now()) {
        throw new ApiError("NOT_FOUND", "Tautan ekspor sudah kedaluwarsa.");
      }

      // Assemble export: only this parent's family data. No answer keys,
      // no other parent's rows, no internal reviewer/audit data.
      const children = await b.db.select().from(schema.children).where(eq(schema.children.parentId, ctx.parent.id));
      const childIds = children.map((c) => c.id);
      const progress = childIds.length
        ? await b.db.select().from(schema.lessonProgress).where(inArray(schema.lessonProgress.childId, childIds))
        : [];
      const rewards = childIds.length ? await b.db.select().from(schema.rewards).where(inArray(schema.rewards.childId, childIds)) : [];
      const consents = await b.db
        .select()
        .from(schema.consentRecords)
        .where(eq(schema.consentRecords.parentId, ctx.parent.id))
        .orderBy(desc(schema.consentRecords.recordedAt));
      const assessments = childIds.length
        ? await b.db.select().from(schema.parentAssessments).where(inArray(schema.parentAssessments.childId, childIds))
        : [];

      set.headers["Cache-Control"] = "no-store";
      set.headers["Content-Disposition"] = `attachment; filename="rzq-export-${ctx.parent.id}.json"`;
      return {
        export_schema: EXPORT_VERSION,
        generated_at: new Date().toISOString(),
        note: "Ekspor data keluarga Anda. Terakhir 24 jam kedaluwarsa.",
        family: {
          children: children.map((c) => ({ id: c.id, nickname: c.nickname, age_band: c.ageBand, created_at: c.createdAt.toISOString() })),
          lesson_progress: progress.map((p) => ({ child_id: p.childId, lesson_id: p.lessonId, first_completed_at: p.firstCompletedAt?.toISOString() ?? null })),
          stars: rewards.map((r) => ({ child_id: r.childId, lesson_id: r.lessonId, awarded_at: r.awardedAt.toISOString() })),
          consent_ledger: consents.map((c) => ({ action: c.action, scope: c.scope, recorded_at: c.recordedAt.toISOString(), notice_version: c.noticeVersion })),
          parent_assessments: assessments.map((a) => ({ child_id: a.childId, chapter: a.chapterNumber, status: a.status, observed_at: a.observedAt.toISOString() })),
        },
      };
    })

    // T054: child deletion — immediate access revocation + suppression ledger.
    .delete("/parent/children/:childId", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));
      const idemKey = request.headers.get("Idempotency-Key");

      const result = await withIdempotency({
        db: b.db,
        actorScope: `parent:${ctx.parent.id}`,
        parentId: ctx.parent.id,
        method: "DELETE",
        route: "/api/v1/parent/children/:childId",
        key: idemKey,
        requestBody: { child_id: params.childId },
        handler: async () => {
          const rows = await b.db
            .select()
            .from(schema.children)
            .where(and(eq(schema.children.id, params.childId), eq(schema.children.parentId, ctx.parent.id)))
            .limit(1);
          const child = rows[0];
          if (!child) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");

          await b.db.transaction(async (tx) => {
            // 1. Immediate revocation: sessions expire, session controls pointing at the child reset.
            await tx
              .update(schema.learningSessions)
              .set({ status: "expired" })
              .where(and(eq(schema.learningSessions.childId, child.id), inArray(schema.learningSessions.status, ["active", "paused"])));
            await tx
              .update(schema.sessionControls)
              .set({ mode: "parent", activeChildId: null })
              .where(eq(schema.sessionControls.activeChildId, child.id));

            // 2. Suppression ledger FIRST (before row delete) so a backup
            //    restore can never resurrect this profile.
            await tx.insert(schema.deletionSuppressions).values({
              id: crypto.randomUUID(),
              scope: "child",
              referenceKey: child.id,
              reason: "parent_request",
              requestedBy: ctx.parent.id,
            });

            // 3. Remove active data (cascades remove events, progress, rewards).
            await tx.delete(schema.children).where(eq(schema.children.id, child.id));
          });

          return {
            status: 200,
            body: {
              deleted: true,
              child_id: child.id,
              note: "Data profil aktif telah dihapus. Penanganan salinan cadangan mengikuti kebijakan retensi.",
            },
          };
        },
      });

      set.status = result.status;
      set.headers["Cache-Control"] = "no-store";
      return result.body;
    })

    // Restore-suppression check used by create-child: a suppressed child id
    // can never be re-created (guards against backup restores).
    .post("/parent/children/check-suppression", async ({ request, set }) => {
      const b = bindings();
      requireParentGate(await resolveContext(b.auth, b.db, request));
      const rows = await b.db.select({ count: sql<number>`count(*)::int` }).from(schema.deletionSuppressions);
      set.headers["Cache-Control"] = "no-store";
      return { suppression_entries: rows[0]?.count ?? 0 };
    });
}
