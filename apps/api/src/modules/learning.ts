// Learning module: catalog (T019/T026 subset), pinned sessions (T020),
// ordered idempotent events (T021), finish + first-completion star (T022).
// Public serializers here NEVER include correct option ids or internal notes.
import { Elysia } from "elysia";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { schema, type Database } from "@rzq/database";
import { answerRequestSchema, eventBatchSchema, startSessionSchema } from "@rzq/contracts";
import { ApiError } from "../errors.ts";
import { requireChildSessionDb, type AppBindings, type ChildContext } from "./context.ts";
import { withIdempotency } from "../idempotency.ts";

type UnitRow = typeof schema.lessonUnits.$inferSelect;
type VersionRow = typeof schema.lessonVersions.$inferSelect;

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

async function sha256Json(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value ?? null)));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function localDateIn(tz: string, at: Date = new Date()): string {
  // ISO date for the profile timezone snapshot (IANA name from settings).
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

async function currentPublishedVersion(b: AppBindings, lessonId: string): Promise<{ lesson: typeof schema.lessons.$inferSelect; version: VersionRow } | null> {
  const rows = await b.db
    .select({ lesson: schema.lessons, version: schema.lessonVersions })
    .from(schema.lessons)
    .innerJoin(schema.lessonVersions, eq(schema.lessonVersions.id, schema.lessons.currentVersionId))
    .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessonVersions.status, "published")))
    .limit(1);
  return rows[0] ?? null;
}

async function versionUnits(b: AppBindings, versionId: string): Promise<UnitRow[]> {
  return b.db
    .select()
    .from(schema.lessonUnits)
    .where(eq(schema.lessonUnits.versionId, versionId))
    .orderBy(asc(schema.lessonUnits.ordinal));
}

async function childUnitProgress(b: AppBindings, childId: string, versionId: string): Promise<Set<string>> {
  const rows = await b.db
    .select({ unitId: schema.sessionUnits.unitId })
    .from(schema.sessionUnits)
    .innerJoin(schema.learningSessions, eq(schema.learningSessions.id, schema.sessionUnits.sessionId))
    .where(and(eq(schema.learningSessions.childId, childId), eq(schema.learningSessions.versionId, versionId)));
  return new Set(rows.map((r) => r.unitId));
}

function fraction(completed: number, required: number) {
  return {
    completed_units: completed,
    required_units: required,
    percent: required === 0 ? 0 : Math.round((completed / required) * 100),
  };
}

async function publicQuestionFor(b: AppBindings, versionId: string, unitId: string) {
  const rows = await b.db
    .select()
    .from(schema.questions)
    .where(and(eq(schema.questions.versionId, versionId), eq(schema.questions.unitId, unitId)))
    .limit(1);
  const q = rows[0];
  if (!q) return null;
  return {
    question_id: q.id,
    unit_id: q.unitId,
    prompt: q.prompt,
    options: q.options, // labels only; correct_option_id never leaves the server pre-answer
  };
}

async function serializeSession(b: AppBindings, ctx: ChildContext, session: typeof schema.learningSessions.$inferSelect) {
  const units = await versionUnits(b, session.versionId);
  const required = units.filter((u) => u.required);
  const completedRows = await b.db
    .select({ unitId: schema.sessionUnits.unitId })
    .from(schema.sessionUnits)
    .where(eq(schema.sessionUnits.sessionId, session.id));
  const completed = new Set(completedRows.map((r) => r.unitId));
  const requiredUnitIds = new Set(required.map((u) => u.id));

  let currentQuestion = null as Awaited<ReturnType<typeof publicQuestionFor>>;
  for (const unit of units) {
    if (unit.unitType !== "choice" || !unit.required || completed.has(unit.id)) continue;
    currentQuestion = await publicQuestionFor(b, session.versionId, unit.id);
    break;
  }

  return {
    session_id: session.id,
    lesson_id: session.lessonId,
    version_id: session.versionId,
    status: session.status,
    last_sequence: session.lastSequence,
    completed_unit_ids: [...completed].filter((id) => requiredUnitIds.has(id)),
    current_question: currentQuestion,
    practice: fraction([...completed].filter((id) => requiredUnitIds.has(id)).length, required.length),
    estimated_active_ms: session.estimatedActiveMs,
    expires_at: session.expiresAt.toISOString(),
  };
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function bumpDailyActivity(
  tx: Tx,
  childId: string,
  tz: string,
  fields: { activeMs?: number; completedSessions?: number; firstAnswers?: number; correctFirstAnswers?: number },
) {
  const localDate = localDateIn(tz);
  await tx
    .insert(schema.dailyActivity)
    .values({
      childId,
      localDate,
      timezoneSnapshot: tz,
      estimatedActiveMs: fields.activeMs ?? 0,
      completedSessions: fields.completedSessions ?? 0,
      firstAnswers: fields.firstAnswers ?? 0,
      correctFirstAnswers: fields.correctFirstAnswers ?? 0,
    })
    .onConflictDoUpdate({
      target: [schema.dailyActivity.childId, schema.dailyActivity.localDate, schema.dailyActivity.timezoneSnapshot],
      set: {
        estimatedActiveMs: sql`${schema.dailyActivity.estimatedActiveMs} + ${fields.activeMs ?? 0}`,
        completedSessions: sql`${schema.dailyActivity.completedSessions} + ${fields.completedSessions ?? 0}`,
        firstAnswers: sql`${schema.dailyActivity.firstAnswers} + ${fields.firstAnswers ?? 0}`,
        correctFirstAnswers: sql`${schema.dailyActivity.correctFirstAnswers} + ${fields.correctFirstAnswers ?? 0}`,
      },
    });
}

export function learningModule(bindings: () => AppBindings) {
  return new Elysia({ prefix: "/api/v1" })
    .get("/catalog", async ({ request, set, query }) => {
      const b = bindings();
      const ctx = await requireChildSessionDb(b.auth, b.db, request);

      const allPublished = await b.db
        .select({ lesson: schema.lessons, version: schema.lessonVersions })
        .from(schema.lessons)
        .innerJoin(schema.lessonVersions, eq(schema.lessonVersions.id, schema.lessons.currentVersionId))
        .where(eq(schema.lessonVersions.status, "published"));

      let rows = [...allPublished];

      // T026: Search and filtering
      const search = (query.search as string | undefined)?.toLowerCase().trim();
      const lessonType = query.lesson_type as string | undefined;
      const stageKey = query.stage_key as string | undefined;

      if (search) {
        rows = rows.filter((r) => r.version.title.toLowerCase().includes(search));
      }
      if (lessonType && lessonType !== "all") {
        rows = rows.filter((r) => r.version.lessonType === lessonType);
      }
      if (stageKey && stageKey !== "all") {
        rows = rows.filter((r) => r.version.stageKey === stageKey);
      }

      // Check stage overrides
      const overrides = await b.db
        .select()
        .from(schema.stageOverrides)
        .where(
          and(
            eq(schema.stageOverrides.childId, ctx.child.id),
            eq(schema.stageOverrides.parentId, ctx.parent.id),
            sql`revoked_at IS NULL`,
          ),
        );
      const overrideLessonIds = new Set(overrides.map((o) => o.lessonId));

      // T027: Prerequisites DAG
      // Check foundational completed lessons
      const completedProgress = await b.db
        .select({ lessonId: schema.lessonProgress.lessonId })
        .from(schema.lessonProgress)
        .where(
          and(
            eq(schema.lessonProgress.childId, ctx.child.id),
            sql`first_completed_at IS NOT NULL`,
          ),
        );
      const completedSet = new Set(completedProgress.map((p) => p.lessonId));

      const items = await Promise.all(
        rows.map(async ({ lesson, version }) => {
          const units = await versionUnits(b, version.id);
          const required = units.filter((u) => u.required);
          const done = await childUnitProgress(b, ctx.child.id, version.id);
          const completedCount = required.filter((u) => done.has(u.id)).length;

          // DAG Prerequisite rule: Stage 3 (short surahs) is locked unless at least one foundational letter lesson is complete, OR overridden by parent
          let access: "available" | "locked" = "available";
          const prerequisiteIds: string[] = [];
          if (version.stageKey === "tahap_3_surat_pendek") {
            const hasFoundation = completedSet.size > 0 || overrideLessonIds.has(lesson.id);
            if (!hasFoundation) {
              access = "locked";
              // point to first lesson as prerequisite
              const firstLesson = allPublished.find((r) => r.version.stageKey === "tahap_1_huruf_dasar");
              if (firstLesson) prerequisiteIds.push(firstLesson.lesson.id);
            }
          }

          return {
            lesson_id: lesson.id,
            version_id: version.id,
            title: version.title,
            lesson_type: version.lessonType,
            stage_key: version.stageKey,
            estimated_minutes: version.estimatedMinutes,
            access,
            prerequisite_lesson_ids: prerequisiteIds,
            demo_only: version.demoOnly,
            practice: fraction(completedCount, required.length),
          };
        }),
      );
      set.headers["Cache-Control"] = "no-store";
      return { items, next_cursor: null };
    })
    .get("/lessons/:lessonId", async ({ request, set, params }) => {
      const b = bindings();
      await requireChildSessionDb(b.auth, b.db, request);
      const found = await currentPublishedVersion(b, params.lessonId);
      if (!found) throw new ApiError("NOT_FOUND", "Materi tidak ditemukan.");
      const { lesson, version } = found;
      const units = await versionUnits(b, version.id);
      const sources =
        version.sourceIds.length > 0
          ? await b.db.select().from(schema.contentSources).where(inArray(schema.contentSources.id, version.sourceIds))
          : [];

      // Fetch authentic canonical texts for any ayah units
      const ayahUnits = units.filter((u) => u.unitType === "ayah" && u.verseKey && u.verseSourceId);
      const verseMap = new Map<string, string>();
      if (ayahUnits.length > 0) {
        const verseKeys = ayahUnits.map((u) => u.verseKey!);
        const verses = await b.db
          .select()
          .from(schema.canonicalVerses)
          .where(inArray(schema.canonicalVerses.verseKey, verseKeys));
        for (const v of verses) {
          verseMap.set(v.verseKey, v.canonicalText);
        }
      }

      set.headers["Cache-Control"] = "no-store";
      return {
        lesson_id: lesson.id,
        version_id: version.id,
        title: version.title,
        lesson_type: version.lessonType,
        demo_only: version.demoOnly,
        units: units.map((u) => ({
          unit_id: u.id,
          ordinal: u.ordinal,
          unit_type: u.unitType,
          required: u.required,
          instruction: u.instruction,
          letter: u.letter,
          verse_ref: u.verseKey && u.verseSourceId ? { source_id: u.verseSourceId, verse_key: u.verseKey } : null,
          canonical_text: u.verseKey ? verseMap.get(u.verseKey) ?? null : null,
          audio_asset_id: u.audioAssetId,
          question_id: null as string | null,
        })),
        attributions: sources.map((s) => ({
          source_title: s.title,
          source_version: s.sourceVersion,
          attribution: s.attribution,
          reciter_name: null,
        })),
      };
    })
    .get("/media/:assetId/playback", async ({ request, set, params }) => {
      const b = bindings();
      await requireChildSessionDb(b.auth, b.db, request);

      const assets = await b.db
        .select()
        .from(schema.mediaAssets)
        .where(eq(schema.mediaAssets.id, params.assetId))
        .limit(1);

      const asset = assets[0];
      if (!asset || asset.status !== "verified") {
        throw new ApiError("MEDIA_UNAVAILABLE", "Audio belum tersedia untuk materi ini.");
      }

      set.headers["Cache-Control"] = "no-store";
      return {
        asset_id: asset.id,
        playback_url: `/api/v1/media/stream/${asset.id}?token=${crypto.randomUUID()}`,
        duration_ms: asset.durationMs ?? 0,
        mime_type: asset.mimeType,
      };
    })
    .get("/learning/current", async ({ request, set }) => {
      const b = bindings();
      const ctx = await requireChildSessionDb(b.auth, b.db, request);
      const rows = await b.db
        .select()
        .from(schema.learningSessions)
        .where(
          and(eq(schema.learningSessions.childId, ctx.child.id), inArray(schema.learningSessions.status, ["active", "paused"])),
        )
        .limit(1);
      set.headers["Cache-Control"] = "no-store";
      return { session: rows[0] ? await serializeSession(b, ctx, rows[0]) : null };
    })
    .post("/learning/sessions", async ({ request, set, body }) => {
      const b = bindings();
      const ctx = await requireChildSessionDb(b.auth, b.db, request);
      const parsed = startSessionSchema.safeParse(body);
      if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Permintaan tidak valid.");
      const idemKey = request.headers.get("Idempotency-Key");
      const result = await withIdempotency({
        db: b.db,
        actorScope: `child:${ctx.child.id}`,
        method: "POST",
        route: "/api/v1/learning/sessions",
        key: idemKey,
        requestBody: body,
        handler: async () => {
          const found = await currentPublishedVersion(b, parsed.data!.lesson_id);
          if (!found) throw new ApiError("NOT_FOUND", "Materi tidak ditemukan.");
          const { lesson, version } = found;
          const existing = await b.db
            .select()
            .from(schema.learningSessions)
            .where(
              and(eq(schema.learningSessions.childId, ctx.child.id), inArray(schema.learningSessions.status, ["active", "paused"])),
            )
            .limit(1);
          if (existing.length > 0) {
            const s = existing[0]!;
            if (s.lessonId === lesson.id) {
              return { status: 200, body: await serializeSession(b, ctx, s) };
            }
            throw new ApiError("SESSION_IN_USE", "Masih ada sesi latihan yang aktif.");
          }
          const inserted = await b.db
            .insert(schema.learningSessions)
            .values({
              id: crypto.randomUUID(),
              childId: ctx.child.id,
              lessonId: lesson.id,
              versionId: version.id,
              status: "active",
              presentationOrder: (await versionUnits(b, version.id)).map((u) => u.id),
              timezoneSnapshot: ctx.child.timezone,
              expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            })
            .returning();
          return { status: 201, body: await serializeSession(b, ctx, inserted[0]!) };
        },
      });
      set.status = result.status;
      set.headers["Cache-Control"] = "no-store";
      return result.body;
    })
    .get("/learning/sessions/:sessionId", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = await requireChildSessionDb(b.auth, b.db, request);
      const rows = await b.db
        .select()
        .from(schema.learningSessions)
        .where(and(eq(schema.learningSessions.id, params.sessionId), eq(schema.learningSessions.childId, ctx.child.id)))
        .limit(1);
      if (rows.length === 0) throw new ApiError("NOT_FOUND", "Sesi tidak ditemukan.");
      set.headers["Cache-Control"] = "no-store";
      return serializeSession(b, ctx, rows[0]!);
    })
    .post("/learning/sessions/:sessionId/events", async ({ request, set, body, params }) => {
      const b = bindings();
      const ctx = await requireChildSessionDb(b.auth, b.db, request);
      const parsed = eventBatchSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError("VALIDATION_ERROR", "Permintaan tidak valid.", parsed.error.flatten());
      }
      const events = parsed.data.events;

      const outcome = await b.db.transaction(async (tx) => {
        const locked = await tx
          .select()
          .from(schema.learningSessions)
          .where(and(eq(schema.learningSessions.id, params.sessionId), eq(schema.learningSessions.childId, ctx.child.id)))
          .for("update")
          .limit(1);
        const session = locked[0];
        if (!session) throw new ApiError("NOT_FOUND", "Sesi tidak ditemukan.");
        if (session.status === "replaced") throw new ApiError("SESSION_REPLACED", "Latihan ini dilanjutkan di sesi lain.");
        if (session.status === "recalled") throw new ApiError("CONTENT_RECALLED", "Materi ini sedang diperiksa.");
        if (session.status === "completed") throw new ApiError("INCOMPLETE_SESSION", "Sesi sudah selesai.");
        if (session.status === "expired" || session.expiresAt.getTime() <= Date.now()) {
          throw new ApiError("SESSION_EXPIRED", "Sesi latihan berakhir.");
        }

        const units = await versionUnits(b, session.versionId);
        const unitById = new Map(units.map((u) => [u.id, u]));
        let lastSequence = session.lastSequence;
        let lastHeartbeatAt = session.lastHeartbeatAt;
        let addedActiveMs = 0;
        let statusDelta: Partial<typeof schema.learningSessions.$inferInsert> = {};
        const results: unknown[] = [];

        for (const event of events) {
          // Replay detection: identical id+payload returns stored result.
          const payloadHash = await sha256Json(event);
          const prior = await tx
            .select()
            .from(schema.learningEvents)
            .where(eq(schema.learningEvents.id, event.event_id))
            .limit(1);
          if (prior.length > 0) {
            const p = prior[0]!;
            if (p.sessionId !== session.id || p.payloadSha256 !== payloadHash) {
              throw new ApiError("EVENT_ID_CONFLICT", "Identitas peristiwa bentrok.");
            }
            results.push({ event_id: event.event_id, replayed: true, result: p.result });
            continue;
          }
          // New events must continue the sequence contiguously.
          if (event.sequence !== lastSequence + 1) {
            throw new ApiError("EVENT_SEQUENCE_CONFLICT", "Urutan peristiwa tidak sesuai.", {
              last_accepted_sequence: lastSequence,
            });
          }

          let result: Record<string, unknown>;
          if (event.type === "unit_acknowledged") {
            const unit = unitById.get(event.unit_id);
            if (!unit) throw new ApiError("VALIDATION_ERROR", "Langkah tidak termasuk dalam sesi ini.");
            if (unit.required) {
              await tx
                .insert(schema.sessionUnits)
                .values({
                  sessionId: session.id,
                  childId: ctx.child.id,
                  versionId: session.versionId,
                  unitId: unit.id,
                })
                .onConflictDoNothing();
            }
            result = { unit_completed: unit.required };
          } else if (event.type === "heartbeat") {
            const reported = event.active_ms;
            let increment = 0;
            if (lastHeartbeatAt) {
              const serverElapsed = Date.now() - lastHeartbeatAt.getTime();
              increment = Math.max(0, Math.min(reported, serverElapsed, 15000));
            }
            addedActiveMs += increment;
            lastHeartbeatAt = new Date();
            result = { accepted_active_ms: increment };
          } else if (event.type === "paused") {
            if (session.status === "active") statusDelta = { status: "paused" };
            result = { paused: true };
          } else {
            // resumed
            if (session.status === "paused") statusDelta = { status: "active" };
            lastHeartbeatAt = null; // next heartbeat re-anchors
            result = { resumed: true };
          }

          await tx.insert(schema.learningEvents).values({
            id: event.event_id,
            sessionId: session.id,
            childId: ctx.child.id,
            sequence: event.sequence,
            eventType: event.type,
            payload: event as unknown as object,
            payloadSha256: payloadHash,
            result,
            clientAt: event.client_at ? new Date(event.client_at) : null,
          });
          lastSequence = event.sequence;
          results.push({ event_id: event.event_id, replayed: false, result });
        }

        await tx
          .update(schema.learningSessions)
          .set({
            lastSequence,
            lastHeartbeatAt,
            estimatedActiveMs: sql`${schema.learningSessions.estimatedActiveMs} + ${addedActiveMs}`,
            ...statusDelta,
          })
          .where(eq(schema.learningSessions.id, session.id));

        if (addedActiveMs > 0) {
          await bumpDailyActivity(tx, ctx.child.id, session.timezoneSnapshot, { activeMs: addedActiveMs });
        }

        return { last_sequence: lastSequence, results };
      });

      set.headers["Cache-Control"] = "no-store";
      return outcome;
    })
    .post("/learning/sessions/:sessionId/answers", async ({ request, set, body, params }) => {
      const b = bindings();
      const ctx = await requireChildSessionDb(b.auth, b.db, request);
      const parsed = answerRequestSchema.safeParse(body);
      if (!parsed.success) throw new ApiError("VALIDATION_ERROR", "Permintaan tidak valid.", parsed.error.flatten());
      const input = parsed.data;

      const outcome = await b.db.transaction(async (tx) => {
        const locked = await tx
          .select()
          .from(schema.learningSessions)
          .where(and(eq(schema.learningSessions.id, params.sessionId), eq(schema.learningSessions.childId, ctx.child.id)))
          .for("update")
          .limit(1);
        const session = locked[0];
        if (!session) throw new ApiError("NOT_FOUND", "Sesi tidak ditemukan.");
        if (!["active", "paused"].includes(session.status)) {
          throw new ApiError("SESSION_EXPIRED", "Sesi latihan berakhir.");
        }
        if (session.expiresAt.getTime() <= Date.now()) throw new ApiError("SESSION_EXPIRED", "Sesi latihan berakhir.");

        // Question must belong to the pinned version.
        const questionRows = await tx
          .select()
          .from(schema.questions)
          .where(and(eq(schema.questions.id, input.question_id), eq(schema.questions.versionId, session.versionId)))
          .limit(1);
        const question = questionRows[0];
        if (!question) throw new ApiError("VALIDATION_ERROR", "Pertanyaan tidak termasuk dalam sesi ini.");
        if (!question.options.some((o) => o.option_id === input.selected_option_id)) {
          throw new ApiError("VALIDATION_ERROR", "Pilihan tidak tersedia.");
        }

        const sequence = session.lastSequence + 1;
        const payloadHash = await sha256Json({ ...input, kind: "answer" });
        const eventRows = await tx
          .insert(schema.learningEvents)
          .values({
            id: input.event_id,
            sessionId: session.id,
            childId: ctx.child.id,
            sequence,
            eventType: "answer",
            payload: { ...input, kind: "answer" },
            payloadSha256: payloadHash,
            result: {},
            clientAt: input.client_at ? new Date(input.client_at) : null,
          })
          .onConflictDoNothing()
          .returning();
        if (eventRows.length === 0) {
          // Same event id retried: return the stored first answer.
          const existingAnswer = await tx
            .select()
            .from(schema.firstAnswers)
            .where(and(eq(schema.firstAnswers.sessionId, session.id), eq(schema.firstAnswers.questionId, question.id)))
            .limit(1);
          const stored = existingAnswer[0];
          return {
            event_id: input.event_id,
            sequence,
            question_id: question.id,
            selected_option_id: stored?.selectedOptionId ?? input.selected_option_id,
            correct: stored?.correct ?? false,
            first_response: false,
            replayed: true,
          };
        }

        const isCorrect = input.selected_option_id === question.correctOptionId;
        const insertedAnswer = await tx
          .insert(schema.firstAnswers)
          .values({
            sessionId: session.id,
            childId: ctx.child.id,
            versionId: session.versionId,
            questionId: question.id,
            firstEventId: input.event_id,
            selectedOptionId: input.selected_option_id,
            correct: isCorrect,
          })
          .onConflictDoNothing()
          .returning();

        if (insertedAnswer.length > 0) {
          await tx
            .update(schema.learningSessions)
            .set({ lastSequence: sequence })
            .where(eq(schema.learningSessions.id, session.id));
          await bumpDailyActivity(tx, ctx.child.id, session.timezoneSnapshot, {
            firstAnswers: 1,
            correctFirstAnswers: isCorrect ? 1 : 0,
          });
          return {
            event_id: input.event_id,
            sequence,
            question_id: question.id,
            selected_option_id: input.selected_option_id,
            correct: isCorrect,
            first_response: true,
            replayed: false,
          };
        }

        // A different event already answered this question: first stands.
        const existingAnswer = await tx
          .select()
          .from(schema.firstAnswers)
          .where(and(eq(schema.firstAnswers.sessionId, session.id), eq(schema.firstAnswers.questionId, question.id)))
          .limit(1);
        const stored = existingAnswer[0]!;
        return {
          event_id: input.event_id,
          sequence,
          question_id: question.id,
          selected_option_id: stored.selectedOptionId,
          correct: stored.correct,
          first_response: false,
          replayed: false,
        };
      });

      set.headers["Cache-Control"] = "no-store";
      return outcome;
    })
    .post("/learning/sessions/:sessionId/finish", async ({ request, set, params }) => {
      const b = bindings();
      const ctx = await requireChildSessionDb(b.auth, b.db, request);
      const idemKey = request.headers.get("Idempotency-Key");

      const outcome = await b.db.transaction(async (tx) => {
        const locked = await tx
          .select()
          .from(schema.learningSessions)
          .where(and(eq(schema.learningSessions.id, params.sessionId), eq(schema.learningSessions.childId, ctx.child.id)))
          .for("update")
          .limit(1);
        const session = locked[0];
        if (!session) throw new ApiError("NOT_FOUND", "Sesi tidak ditemukan.");

        if (session.status === "completed") {
          // Idempotent replay: return completion without another star.
          const required = (await versionUnits(b, session.versionId)).filter((u) => u.required);
          return {
            session_id: session.id,
            lesson_id: session.lessonId,
            status: "completed" as const,
            star_awarded: false,
            practice: fraction(required.length, required.length),
          };
        }
        if (!["active", "paused"].includes(session.status)) {
          throw new ApiError("SESSION_EXPIRED", "Sesi latihan berakhir.");
        }

        const units = await versionUnits(b, session.versionId);
        const required = units.filter((u) => u.required);
        const completedRows = await tx
          .select({ unitId: schema.sessionUnits.unitId })
          .from(schema.sessionUnits)
          .where(eq(schema.sessionUnits.sessionId, session.id));
        const completed = new Set(completedRows.map((r) => r.unitId));
        const missing = required.filter((u) => !completed.has(u.id));
        if (missing.length > 0) {
          throw new ApiError("INCOMPLETE_SESSION", "Masih ada langkah yang belum selesai.", {
            remaining_unit_count: missing.length,
          });
        }

        const now = new Date();
        await tx
          .update(schema.learningSessions)
          .set({ status: "completed", completedAt: now })
          .where(eq(schema.learningSessions.id, session.id));
        await tx
          .insert(schema.lessonProgress)
          .values({
            childId: ctx.child.id,
            lessonId: session.lessonId,
            firstCompletedAt: now,
            lastPracticedAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.lessonProgress.childId, schema.lessonProgress.lessonId],
            set: { lastPracticedAt: now },
          });
        const starRows = await tx
          .insert(schema.rewards)
          .values({
            id: crypto.randomUUID(),
            childId: ctx.child.id,
            lessonId: session.lessonId,
            rewardType: "first_completion_star",
          })
          .onConflictDoNothing()
          .returning();
        await bumpDailyActivity(tx, ctx.child.id, session.timezoneSnapshot, { completedSessions: 1 });

        return {
          session_id: session.id,
          lesson_id: session.lessonId,
          status: "completed" as const,
          star_awarded: starRows.length > 0,
          practice: fraction(required.length, required.length),
        };
      });

      set.status = 200;
      set.headers["Cache-Control"] = "no-store";
      return outcome;
    })
    .get("/learning/progress", async ({ request, set }) => {
      const b = bindings();
      const ctx = await requireChildSessionDb(b.auth, b.db, request);
      const stars = await b.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.rewards)
        .where(eq(schema.rewards.childId, ctx.child.id));

      const completedRows = await b.db
        .select({
          lessonId: schema.lessonProgress.lessonId,
          lessonType: schema.lessonVersions.lessonType,
        })
        .from(schema.lessonProgress)
        .innerJoin(schema.lessons, eq(schema.lessons.id, schema.lessonProgress.lessonId))
        .innerJoin(schema.lessonVersions, eq(schema.lessonVersions.id, schema.lessons.currentVersionId))
        .where(
          and(
            eq(schema.lessonProgress.childId, ctx.child.id),
            sql`first_completed_at IS NOT NULL`,
          ),
        );

      // T039: Descriptive non-punitive practice achievements
      const achievements: { key: string; title: string; description: string }[] = [];
      if (completedRows.length >= 1) {
        achievements.push({
          key: "langkah_pertama",
          title: "Langkah Pertama",
          description: "Menyelesaikan pelajaran pertama dengan tekun.",
        });
      }
      const hijaiyahCount = completedRows.filter((r) => r.lessonType === "listening").length;
      if (hijaiyahCount >= 3) {
        achievements.push({
          key: "sahabat_huruf",
          title: "Sahabat Huruf",
          description: "Berhasil mengenal dan melafalkan 3 huruf hijaiyah.",
        });
      }
      const surahCount = completedRows.filter((r) => r.lessonType === "surah").length;
      if (surahCount >= 1) {
        achievements.push({
          key: "latihan_surat",
          title: "Latihan Surat Pendek",
          description: "Mulai melatih hafalan ayat surat pendek.",
        });
      }

      set.headers["Cache-Control"] = "no-store";
      return {
        child_nickname: ctx.child.nickname,
        stars: stars[0]?.count ?? 0,
        achievements,
      };
    });
}
