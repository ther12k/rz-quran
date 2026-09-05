// Learning records: sessions, append-only events, projections, rewards,
// plus operational tables (idempotency, jobs, audit).
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { children } from "./identity.ts";
import { lessonUnits, lessonVersions, lessons, questions } from "./content.ts";

export const learningSessions = pgTable(
  "learning_sessions",
  {
    id: uuid("id").primaryKey(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").notNull(),
    versionId: uuid("version_id").notNull(),
    status: text("status")
      .notNull()
      .default("active")
      .$type<"active" | "paused" | "completed" | "replaced" | "expired" | "recalled">(),
    presentationOrder: jsonb("presentation_order").notNull().default([]),
    lastSequence: integer("last_sequence").notNull().default(0),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    estimatedActiveMs: bigint("estimated_active_ms", { mode: "number" }).notNull().default(0),
    timezoneSnapshot: text("timezone_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "learning_sessions_version_fk",
      columns: [t.versionId, t.lessonId],
      foreignColumns: [lessonVersions.id, lessonVersions.lessonId],
    }),
    unique("learning_sessions_id_child").on(t.id, t.childId),
    unique("learning_sessions_id_child_version").on(t.id, t.childId, t.versionId),
    index("learning_sessions_child_date_idx").on(t.childId, t.createdAt.desc()),
    // Concurrency backstop: only one writable (active/paused) session per child.
    uniqueIndex("one_writable_session_per_child")
      .on(t.childId)
      .where(sql`${t.status} in ('active','paused')`),
    check("learning_sessions_sequence_nonnegative", sql`${t.lastSequence} >= 0`),
    check("learning_sessions_active_nonnegative", sql`${t.estimatedActiveMs} >= 0`),
    check("learning_sessions_expiry_after_creation", sql`${t.expiresAt} > ${t.createdAt}`),
    check("learning_sessions_completed_shape", sql`${t.status} <> 'completed' or ${t.completedAt} is not null`),
  ],
);

export const learningEvents = pgTable(
  "learning_events",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id").notNull(),
    childId: uuid("child_id").notNull(),
    sequence: integer("sequence").notNull(),
    eventType: text("event_type")
      .notNull()
      .$type<"unit_acknowledged" | "heartbeat" | "paused" | "resumed" | "answer">(),
    payload: jsonb("payload").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    result: jsonb("result").notNull(),
    clientAt: timestamp("client_at", { withTimezone: true }),
    serverAt: timestamp("server_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "learning_events_session_fk",
      columns: [t.sessionId, t.childId],
      foreignColumns: [learningSessions.id, learningSessions.childId],
      onDelete: "cascade",
    }),
    unique("learning_events_session_sequence").on(t.sessionId, t.sequence),
    unique("learning_events_id_session").on(t.id, t.sessionId),
    check("learning_events_sequence_positive", sql`${t.sequence} > 0`),
    check("learning_events_payload_hash_format", sql`${t.payloadSha256} ~ '^[a-f0-9]{64}$'`),
  ],
);

export const sessionUnits = pgTable(
  "session_units",
  {
    sessionId: uuid("session_id").notNull(),
    childId: uuid("child_id").notNull(),
    versionId: uuid("version_id").notNull(),
    unitId: uuid("unit_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.unitId] }),
    foreignKey({
      name: "session_units_session_fk",
      columns: [t.sessionId, t.childId, t.versionId],
      foreignColumns: [learningSessions.id, learningSessions.childId, learningSessions.versionId],
      onDelete: "cascade",
    }),
    foreignKey({
      name: "session_units_unit_fk",
      columns: [t.unitId, t.versionId],
      foreignColumns: [lessonUnits.id, lessonUnits.versionId],
    }),
  ],
);

export const firstAnswers = pgTable(
  "first_answers",
  {
    sessionId: uuid("session_id").notNull(),
    childId: uuid("child_id").notNull(),
    versionId: uuid("version_id").notNull(),
    questionId: uuid("question_id").notNull(),
    firstEventId: uuid("first_event_id").notNull(),
    selectedOptionId: text("selected_option_id").notNull(),
    correct: boolean("correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.questionId] }),
    foreignKey({
      name: "first_answers_session_fk",
      columns: [t.sessionId, t.childId, t.versionId],
      foreignColumns: [learningSessions.id, learningSessions.childId, learningSessions.versionId],
      onDelete: "cascade",
    }),
    foreignKey({
      name: "first_answers_question_fk",
      columns: [t.questionId, t.versionId],
      foreignColumns: [questions.id, questions.versionId],
    }),
    foreignKey({
      name: "first_answers_event_fk",
      columns: [t.firstEventId, t.sessionId],
      foreignColumns: [learningEvents.id, learningEvents.sessionId],
      onDelete: "cascade",
    }),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    firstCompletedAt: timestamp("first_completed_at", { withTimezone: true }),
    lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
    resumeSessionId: uuid("resume_session_id"),
  },
  (t) => [
    unique("lesson_progress_child_lesson").on(t.childId, t.lessonId),
    foreignKey({
      name: "lesson_progress_resume_fk",
      columns: [t.resumeSessionId, t.childId],
      foreignColumns: [learningSessions.id, learningSessions.childId],
    }),
  ],
);

export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").primaryKey(),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    rewardType: text("reward_type").notNull().$type<"first_completion_star">(),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("rewards_child_lesson_type").on(t.childId, t.lessonId, t.rewardType),
    check("rewards_type_domain", sql`${t.rewardType} = 'first_completion_star'`),
  ],
);

// Operational records -------------------------------------------------------

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    actorScope: text("actor_scope").notNull(),
    parentId: uuid("parent_id"),
    method: text("method").notNull(),
    route: text("route").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    requestSha256: text("request_sha256").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("idempotency_records_key").on(t.actorScope, t.method, t.route, t.idempotencyKey),
    check("idempotency_hash_format", sql`${t.requestSha256} ~ '^[a-f0-9]{64}$'`),
    check("idempotency_status_range", sql`${t.responseStatus} between 100 and 599`),
    check("idempotency_expiry", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey(),
  kind: text("kind")
    .notNull()
    .$type<"import" | "asset_verify" | "export" | "delete_child" | "delete_account">(),
  parentId: uuid("parent_id"),
  staffActorId: text("staff_actor_id"),
  payload: jsonb("payload").notNull(),
  status: text("status")
    .notNull()
    .default("queued")
    .$type<"queued" | "running" | "succeeded" | "failed" | "canceled">(),
  attempts: integer("attempts").notNull().default(0),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  resultObjectKey: text("result_object_key"),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    actorReference: text("actor_reference").notNull(),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id").notNull(),
    outcome: text("outcome").notNull().$type<"success" | "denied" | "failed">(),
    requestId: text("request_id").notNull(),
    redactedMetadata: jsonb("redacted_metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_events_date_idx").on(t.createdAt.desc()),
    check("audit_outcome_domain", sql`${t.outcome} in ('success','denied','failed')`),
  ],
);
