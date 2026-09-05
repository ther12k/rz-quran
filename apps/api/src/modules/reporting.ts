// Reporting module: gated, owner-scoped parent progress summary (T024).
// All numbers derive from stored server-accepted records; empty states are
// honest (no invented sample data).
import { Elysia } from "elysia";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { schema } from "@rzq/database";
import { ApiError } from "../errors.ts";
import { resolveContext, requireParentGate, type AppBindings } from "./context.ts";

function localDateIn(tz: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

function shiftDate(days: number, tz: string): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return localDateIn(tz, d);
}

export function reportingModule(bindings: () => AppBindings) {
  return new Elysia({ prefix: "/api/v1" })
    .get("/parent/children/:childId/progress", async ({ request, set, params, query }) => {
      const b = bindings();
      const ctx = requireParentGate(await resolveContext(b.auth, b.db, request));

      const childRows = await b.db
        .select()
        .from(schema.children)
        .where(and(eq(schema.children.id, params.childId), eq(schema.children.parentId, ctx.parent.id)))
        .limit(1);
      const child = childRows[0];
      if (!child) throw new ApiError("NOT_FOUND", "Profil tidak ditemukan.");

      const intervalDays = Math.min(Math.max(Number(query.interval_days ?? 7), 1), 90);
      const tz = child.timezone;
      const sinceLocalDate = shiftDate(intervalDays - 1, tz);

      // Published lessons form the reporting denominator.
      const published = await b.db
        .select({ lesson: schema.lessons, version: schema.lessonVersions })
        .from(schema.lessons)
        .innerJoin(schema.lessonVersions, eq(schema.lessonVersions.id, schema.lessons.currentVersionId))
        .where(eq(schema.lessonVersions.status, "published"));

      const lessonIds = published.map((p) => p.lesson.id);
      const progressRows =
        lessonIds.length > 0
          ? await b.db
              .select()
              .from(schema.lessonProgress)
              .where(and(eq(schema.lessonProgress.childId, child.id), inArray(schema.lessonProgress.lessonId, lessonIds)))
          : [];
      const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));

      // Daily buckets for the interval (zero-filled for the chart/table).
      const dailyRows = await b.db
        .select()
        .from(schema.dailyActivity)
        .where(
          and(
            eq(schema.dailyActivity.childId, child.id),
            gte(schema.dailyActivity.localDate, sinceLocalDate),
            eq(schema.dailyActivity.timezoneSnapshot, tz),
          ),
        );
      const dailyByDate = new Map(dailyRows.map((d) => [d.localDate, d]));
      const daily: { local_date: string; estimated_active_ms: number; completed_sessions: number }[] = [];
      for (let i = intervalDays - 1; i >= 0; i--) {
        const date = shiftDate(i, tz);
        const row = dailyByDate.get(date);
        daily.push({
          local_date: date,
          estimated_active_ms: row?.estimatedActiveMs ?? 0,
          completed_sessions: row?.completedSessions ?? 0,
        });
      }

      // First-answer accuracy within the interval, from daily projection.
      const firstAnswers = dailyRows.reduce((a, d) => a + d.firstAnswers, 0);
      const correctFirst = dailyRows.reduce((a, d) => a + d.correctFirstAnswers, 0);

      // Surah practice: distinct surah lessons with any accepted practice.
      const surahLessons = published.filter((p) => p.version.lessonType === "surah");
      let distinctSurahs = 0;
      if (surahLessons.length > 0) {
        const practiced = progressRows.filter(
          (p) => surahLessons.some((s) => s.lesson.id === p.lessonId) && p.lastPracticedAt,
        );
        distinctSurahs = practiced.length;
      }

      // Per-lesson unit progress against the current published version.
      const lessons = await Promise.all(
        published.map(async ({ lesson, version }) => {
          const unitRows = await b.db
            .select({ id: schema.lessonUnits.id, required: schema.lessonUnits.required })
            .from(schema.lessonUnits)
            .where(eq(schema.lessonUnits.versionId, version.id));
          const requiredIds = unitRows.filter((u) => u.required).map((u) => u.id);
          let completedUnits = 0;
          if (requiredIds.length > 0) {
            const doneRows = await b.db
              .select({ count: sql<number>`count(distinct ${schema.sessionUnits.unitId})::int` })
              .from(schema.sessionUnits)
              .innerJoin(schema.learningSessions, eq(schema.learningSessions.id, schema.sessionUnits.sessionId))
              .where(
                and(
                  eq(schema.learningSessions.childId, child.id),
                  eq(schema.learningSessions.versionId, version.id),
                  inArray(schema.sessionUnits.unitId, requiredIds),
                ),
              );
            completedUnits = doneRows[0]?.count ?? 0;
          }
          const progress = progressByLesson.get(lesson.id);
          return {
            lesson_id: lesson.id,
            title: version.title,
            lesson_type: version.lessonType,
            completed: Boolean(progress?.firstCompletedAt),
            practice: {
              completed_units: completedUnits,
              required_units: requiredIds.length,
              percent: requiredIds.length === 0 ? 0 : Math.round((completedUnits / requiredIds.length) * 100),
            },
            last_practiced_at: progress?.lastPracticedAt?.toISOString() ?? null,
          };
        }),
      );

      set.headers["Cache-Control"] = "no-store";
      return {
        child_id: child.id,
        interval_days: intervalDays,
        timezone: tz,
        lessons_completed: progressRows.filter((p) => p.firstCompletedAt).length,
        lessons_total: published.length,
        distinct_surahs_practiced: distinctSurahs,
        quiz_first_answers: firstAnswers,
        quiz_correct_first_answers: correctFirst,
        quiz_accuracy_percent: firstAnswers === 0 ? null : Math.round((correctFirst / firstAnswers) * 100),
        estimated_active_ms: dailyRows.reduce((a, d) => a + d.estimatedActiveMs, 0),
        daily,
        lessons,
      };
    });
}
