// Admin & Editorial Module (Milestone M3)
// Enforces staff capabilities, mandatory second-person review (reviewer != author),
// asset quarantine, instant recall, and audit trail.
import { Elysia } from "elysia";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@rzq/database";
import { authoringLessonSchema, computeReleaseHash } from "@rzq/contracts";
import { ApiError } from "../errors.ts";
import { resolveContext, requireAdultSession, type AppBindings, type RequestContext } from "./context.ts";

export type StaffCapability = "content_editor" | "content_reviewer" | "content_publisher" | "ops_admin";

async function requireStaffCapability(
  b: AppBindings,
  request: Request,
  capability: StaffCapability,
): Promise<{ ctx: RequestContext; staff: typeof schema.staffMembers.$inferSelect }> {
  const ctx = requireAdultSession(await resolveContext(b.auth, b.db, request));
  const staffRows = await b.db
    .select()
    .from(schema.staffMembers)
    .where(and(eq(schema.staffMembers.authUserId, ctx.authUserId), eq(schema.staffMembers.active, true)))
    .limit(1);

  const staff = staffRows[0];
  if (!staff || !staff.capabilities.includes(capability)) {
    throw new ApiError("CAPABILITY_REQUIRED", `Tindakan ini memerlukan kewenangan: ${capability}`);
  }

  return { ctx, staff };
}

async function recordAuditEvent(
  b: AppBindings,
  actorReference: string,
  action: string,
  objectType: string,
  objectId: string,
  outcome: "success" | "denied" | "failed",
  metadata: Record<string, unknown> = {},
) {
  await b.db
    .insert(schema.auditEvents)
    .values({
      id: crypto.randomUUID(),
      actorReference,
      action,
      objectType,
      objectId,
      outcome,
      requestId: b.requestId,
      redactedMetadata: metadata,
    })
    .onConflictDoNothing();
}

export function adminModule(bindings: () => AppBindings) {
  return new Elysia({ prefix: "/api/v1" })
    // T041: Source and Rights Registry
    .get("/admin/sources", async ({ request, set }) => {
      const b = bindings();
      await requireStaffCapability(b, request, "content_editor");
      const rows = await b.db.select().from(schema.contentSources).orderBy(desc(schema.contentSources.createdAt));
      set.headers["Cache-Control"] = "no-store";
      return {
        items: rows.map((r) => ({
          id: r.id,
          source_kind: r.sourceKind,
          title: r.title,
          source_version: r.sourceVersion,
          upstream_reference: r.upstreamReference,
          acquired_at: r.acquiredAt.toISOString(),
          demo_only: r.demoOnly,
          rights_status: r.rightsStatus,
          permitted_uses: r.permittedUses,
          license_reference: r.licenseReference,
          attribution: r.attribution,
          registered_by: r.registeredBy,
          reviewed_by: r.reviewedBy,
        })),
        next_cursor: null,
      };
    })
    .post("/admin/sources", async ({ request, set, body }) => {
      const b = bindings();
      const { staff } = await requireStaffCapability(b, request, "content_editor");
      const data = body as {
        source_kind: "quran_text" | "quran_audio" | "hijaiyah_audio" | "translation" | "illustration" | "lesson_notes";
        title: string;
        source_version: string;
        upstream_reference?: string;
        demo_only?: boolean;
        permitted_uses?: string[];
        license_reference?: string;
        attribution?: string;
      };

      if (!data.source_kind || !data.title || !data.source_version) {
        throw new ApiError("VALIDATION_ERROR", "Data sumber tidak lengkap.");
      }

      const id = crypto.randomUUID();
      const inserted = await b.db
        .insert(schema.contentSources)
        .values({
          id,
          sourceKind: data.source_kind,
          title: data.title,
          sourceVersion: data.source_version,
          upstreamReference: data.upstream_reference ?? null,
          acquiredAt: new Date(),
          demoOnly: Boolean(data.demo_only),
          rightsStatus: "pending",
          permittedUses: data.permitted_uses ?? [],
          licenseReference: data.license_reference ?? null,
          attribution: data.attribution ?? "",
          registeredBy: staff.authUserId,
        })
        .returning();

      const r = inserted[0]!;
      await recordAuditEvent(b, staff.authUserId, "register_source", "content_source", id, "success");
      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return {
        id: r.id,
        source_kind: r.sourceKind,
        title: r.title,
        source_version: r.sourceVersion,
        upstream_reference: r.upstreamReference,
        acquired_at: r.acquiredAt.toISOString(),
        demo_only: r.demoOnly,
        rights_status: r.rightsStatus,
        permitted_uses: r.permittedUses,
        license_reference: r.licenseReference,
        attribution: r.attribution,
        registered_by: r.registeredBy,
        reviewed_by: r.reviewedBy,
      };
    })
    .patch("/admin/sources/:sourceId/rights", async ({ request, set, params, body }) => {
      const b = bindings();
      const { staff } = await requireStaffCapability(b, request, "content_reviewer");
      const data = body as { rights_status: "approved" | "denied" | "revoked"; permitted_uses?: string[]; license_reference?: string };

      if (!["approved", "denied", "revoked"].includes(data.rights_status)) {
        throw new ApiError("VALIDATION_ERROR", "Status hak cipta tidak valid.");
      }

      const rows = await b.db
        .update(schema.contentSources)
        .set({
          rightsStatus: data.rights_status,
          ...(data.permitted_uses ? { permittedUses: data.permitted_uses } : {}),
          ...(data.license_reference ? { licenseReference: data.license_reference } : {}),
          reviewedBy: staff.authUserId,
          updatedAt: new Date(),
        })
        .where(eq(schema.contentSources.id, params.sourceId))
        .returning();

      if (rows.length === 0) throw new ApiError("NOT_FOUND", "Sumber tidak ditemukan.");
      const r = rows[0]!;
      await recordAuditEvent(b, staff.authUserId, "review_source_rights", "content_source", params.sourceId, "success");
      set.headers["Cache-Control"] = "no-store";
      return {
        id: r.id,
        source_kind: r.sourceKind,
        title: r.title,
        source_version: r.sourceVersion,
        upstream_reference: r.upstreamReference,
        acquired_at: r.acquiredAt.toISOString(),
        demo_only: r.demoOnly,
        rights_status: r.rightsStatus,
        permitted_uses: r.permittedUses,
        license_reference: r.licenseReference,
        attribution: r.attribution,
        registered_by: r.registeredBy,
        reviewed_by: r.reviewedBy,
      };
    })

    // T042: Media Assets & Quarantine
    .get("/admin/assets", async ({ request, set }) => {
      const b = bindings();
      await requireStaffCapability(b, request, "content_editor");
      const rows = await b.db.select().from(schema.mediaAssets).orderBy(desc(schema.mediaAssets.createdAt));
      set.headers["Cache-Control"] = "no-store";
      return {
        items: rows.map((r) => ({
          id: r.id,
          source_id: r.sourceId,
          object_key: r.objectKey,
          kind: r.kind,
          mime_type: r.mimeType,
          size_bytes: Number(r.sizeBytes),
          sha256: r.sha256,
          duration_ms: r.durationMs,
          status: r.status,
          delivery_policy: r.deliveryPolicy,
          created_at: r.createdAt.toISOString(),
        })),
        next_cursor: null,
      };
    })
    .post("/admin/assets", async ({ request, set, body }) => {
      const b = bindings();
      const { staff } = await requireStaffCapability(b, request, "content_editor");
      const data = body as {
        source_id: string;
        object_key: string;
        kind: "audio" | "image" | "source_file";
        mime_type: string;
        size_bytes: number;
        sha256?: string;
        duration_ms?: number;
      };

      if (!data.source_id || !data.object_key || !data.kind || !data.mime_type) {
        throw new ApiError("VALIDATION_ERROR", "Data aset tidak lengkap.");
      }

      const id = crypto.randomUUID();
      const inserted = await b.db
        .insert(schema.mediaAssets)
        .values({
          id,
          sourceId: data.source_id,
          objectKey: data.object_key,
          kind: data.kind,
          mimeType: data.mime_type,
          sizeBytes: data.size_bytes,
          sha256: data.sha256 ?? null,
          durationMs: data.duration_ms ?? null,
          status: "quarantine", // T042: Starts in quarantine
          deliveryPolicy: "stream",
        })
        .returning();

      // Enqueue verification job (T043)
      await b.db.insert(schema.jobs).values({
        id: crypto.randomUUID(),
        kind: "asset_verify",
        staffActorId: staff.authUserId,
        payload: { asset_id: id, expected_sha256: data.sha256 },
        status: "queued",
      });

      await recordAuditEvent(b, staff.authUserId, "upload_asset", "media_asset", id, "success");
      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return inserted[0]!;
    })

    // T044 & T045: Lesson Drafts & Mandatory Second-Person Review
    .post("/admin/lessons/drafts", async ({ request, set, body }) => {
      const b = bindings();
      const { staff } = await requireStaffCapability(b, request, "content_editor");
      const parsed = authoringLessonSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError("VALIDATION_ERROR", "Format materi tidak valid.", parsed.error.flatten());
      }
      const data = parsed.data;

      // Ensure logical lesson exists
      let lessonRows = await b.db.select().from(schema.lessons).where(eq(schema.lessons.id, data.lesson_id)).limit(1);
      if (lessonRows.length === 0) {
        await b.db.insert(schema.lessons).values({
          id: data.lesson_id,
          stableKey: `lesson_${data.stage_key}_${Date.now()}`,
        });
      }

      // Check next version number
      const existingVersions = await b.db
        .select({ versionNumber: schema.lessonVersions.versionNumber })
        .from(schema.lessonVersions)
        .where(eq(schema.lessonVersions.lessonId, data.lesson_id))
        .orderBy(desc(schema.lessonVersions.versionNumber))
        .limit(1);
      const nextVersion = (existingVersions[0]?.versionNumber ?? 0) + 1;

      const versionId = data.version_id ?? crypto.randomUUID();
      const releaseHash = await computeReleaseHash(data);

      await b.db.transaction(async (tx) => {
        await tx.insert(schema.lessonVersions).values({
          id: versionId,
          lessonId: data.lesson_id,
          versionNumber: nextVersion,
          title: data.title,
          lessonType: data.lesson_type,
          stageKey: data.stage_key,
          estimatedMinutes: data.estimated_minutes,
          demoOnly: data.demo_only,
          sourceIds: data.source_ids,
          status: "draft",
          releaseHash,
          authorId: staff.authUserId,
        });

        for (const u of data.units) {
          await tx.insert(schema.lessonUnits).values({
            id: u.unit_id,
            versionId,
            ordinal: u.ordinal,
            unitType: u.unit_type,
            required: u.required,
            instruction: u.instruction,
            letter: u.letter ?? null,
            verseSourceId: u.verse_ref?.source_id ?? null,
            verseKey: u.verse_ref?.verse_key ?? null,
            audioAssetId: u.audio_asset_id ?? null,
          });
        }

        for (const q of data.questions) {
          await tx.insert(schema.questions).values({
            id: q.question_id,
            unitId: q.unit_id,
            versionId,
            prompt: q.prompt,
            options: q.options,
            correctOptionId: q.correct_option_id,
            explanation: q.explanation,
            sourceIds: q.source_ids,
          });
        }
      });

      await recordAuditEvent(b, staff.authUserId, "create_draft", "lesson_version", versionId, "success");
      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return { version_id: versionId, version_number: nextVersion, status: "draft", release_hash: releaseHash };
    })
    .post("/admin/lessons/drafts/:draftId/submit", async ({ request, set, params }) => {
      const b = bindings();
      const { staff } = await requireStaffCapability(b, request, "content_editor");
      const rows = await b.db
        .update(schema.lessonVersions)
        .set({ status: "in_review", updatedAt: new Date() })
        .where(and(eq(schema.lessonVersions.id, params.draftId), eq(schema.lessonVersions.status, "draft")))
        .returning();

      if (rows.length === 0) throw new ApiError("NOT_FOUND", "Draft tidak ditemukan atau bukan berstatus draft.");
      await recordAuditEvent(b, staff.authUserId, "submit_draft_for_review", "lesson_version", params.draftId, "success");
      set.headers["Cache-Control"] = "no-store";
      return { status: "in_review" };
    })
    .post("/admin/lessons/drafts/:draftId/reviews", async ({ request, set, params, body }) => {
      const b = bindings();
      // T045: Second person reviewer required
      const { staff } = await requireStaffCapability(b, request, "content_reviewer");
      const data = body as { decision: "approve" | "reject"; note?: string; checks?: Record<string, boolean> };

      const versionRows = await b.db
        .select()
        .from(schema.lessonVersions)
        .where(eq(schema.lessonVersions.id, params.draftId))
        .limit(1);
      const v = versionRows[0];
      if (!v) throw new ApiError("NOT_FOUND", "Materi tidak ditemukan.");

      // Invariant: Reviewer cannot be the author
      if (v.authorId === staff.authUserId) {
        await recordAuditEvent(b, staff.authUserId, "review_draft", "lesson_version", params.draftId, "denied", {
          reason: "self_review_prohibited",
        });
        throw new ApiError("REVIEW_REQUIRED", "Peninjau tidak boleh sama dengan penulis materi (wajib 2 orang berbeda).");
      }

      const reviewId = crypto.randomUUID();
      await b.db.transaction(async (tx) => {
        await tx.insert(schema.contentReviews).values({
          id: reviewId,
          versionId: v.id,
          reviewerId: staff.authUserId,
          decision: data.decision,
          releaseHash: v.releaseHash ?? "unknown_hash",
          checks: data.checks ?? { text_verified: true, diacritics_verified: true },
          note: data.note ?? "",
        });

        await tx
          .update(schema.lessonVersions)
          .set({
            status: data.decision === "approve" ? "approved" : "draft",
            reviewerId: staff.authUserId,
            updatedAt: new Date(),
          })
          .where(eq(schema.lessonVersions.id, v.id));
      });

      await recordAuditEvent(b, staff.authUserId, "review_draft", "lesson_version", params.draftId, "success", {
        decision: data.decision,
      });
      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return { review_id: reviewId, decision: data.decision, status: data.decision === "approve" ? "approved" : "draft" };
    })
    .post("/admin/lessons/drafts/:draftId/publish", async ({ request, set, params }) => {
      const b = bindings();
      const { staff } = await requireStaffCapability(b, request, "content_publisher");

      const versionRows = await b.db
        .select()
        .from(schema.lessonVersions)
        .where(and(eq(schema.lessonVersions.id, params.draftId), eq(schema.lessonVersions.status, "approved")))
        .limit(1);
      const v = versionRows[0];
      if (!v) throw new ApiError("NOT_FOUND", "Materi belum disetujui untuk dipublikasikan.");

      await b.db.transaction(async (tx) => {
        await tx
          .update(schema.lessonVersions)
          .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.lessonVersions.id, v.id));

        await tx
          .update(schema.lessons)
          .set({ currentVersionId: v.id })
          .where(eq(schema.lessons.id, v.lessonId));
      });

      await recordAuditEvent(b, staff.authUserId, "publish_lesson", "lesson_version", params.draftId, "success");
      set.headers["Cache-Control"] = "no-store";
      return { status: "published", version_id: v.id };
    })

    // T047: Instant Recall Mechanism
    .post("/admin/lessons/:lessonId/recall", async ({ request, set, params, body }) => {
      const b = bindings();
      const { staff } = await requireStaffCapability(b, request, "content_publisher");
      const data = body as { reason?: string };

      const lessonRows = await b.db.select().from(schema.lessons).where(eq(schema.lessons.id, params.lessonId)).limit(1);
      const lesson = lessonRows[0];
      if (!lesson || !lesson.currentVersionId) throw new ApiError("NOT_FOUND", "Materi tidak ditemukan.");

      const versionId = lesson.currentVersionId;

      await b.db.transaction(async (tx) => {
        // Mark version recalled
        await tx
          .update(schema.lessonVersions)
          .set({ status: "recalled", updatedAt: new Date() })
          .where(eq(schema.lessonVersions.id, versionId));

        // Invalidate active learning sessions
        await tx
          .update(schema.learningSessions)
          .set({ status: "recalled" })
          .where(and(eq(schema.learningSessions.versionId, versionId), sql`status in ('active', 'paused')`));
      });

      await recordAuditEvent(b, staff.authUserId, "recall_lesson", "lesson", params.lessonId, "success", {
        reason: data.reason ?? "immediate_recall",
      });

      set.headers["Cache-Control"] = "no-store";
      return { success: true, recalled_version_id: versionId };
    })

    // T048: Parent Content Discrepancy Reporting
    .post("/parent/content-reports", async ({ request, set, body }) => {
      const b = bindings();
      const ctx = requireAdultSession(await resolveContext(b.auth, b.db, request));
      const data = body as { version_id: string; reason: "wrong_text" | "wrong_audio" | "unclear_instruction" | "other"; note?: string };

      if (!data.version_id || !data.reason) {
        throw new ApiError("VALIDATION_ERROR", "Laporan tidak lengkap.");
      }

      const id = crypto.randomUUID();
      await b.db.insert(schema.contentReports).values({
        id,
        parentId: ctx.parent.id,
        versionId: data.version_id,
        reason: data.reason,
        note: data.note ?? "",
        status: "new",
      });

      await recordAuditEvent(b, ctx.parent.id, "report_content", "content_report", id, "success");
      set.status = 201;
      set.headers["Cache-Control"] = "no-store";
      return { id, status: "new" };
    })

    // T050: Content Audit Trail
    .get("/admin/audit-events", async ({ request, set }) => {
      const b = bindings();
      await requireStaffCapability(b, request, "ops_admin");
      const rows = await b.db.select().from(schema.auditEvents).orderBy(desc(schema.auditEvents.createdAt)).limit(50);
      set.headers["Cache-Control"] = "no-store";
      return { items: rows, next_cursor: null };
    });
}
