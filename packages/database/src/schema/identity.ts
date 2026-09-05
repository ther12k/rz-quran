// Identity and household records, translated from database/domain-reference.sql.
// UUIDs are application-supplied (crypto.randomUUID) unless noted.
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth.ts";
import { lessons } from "./content.ts";

export const parents = pgTable("parents", {
  id: uuid("id").primaryKey(),
  authUserId: text("auth_user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  eligibilityStatus: text("eligibility_status").notNull().default("pending").$type<"pending" | "approved" | "blocked">(),
  status: text("status").notNull().default("active").$type<"active" | "suspended" | "deletion_pending">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffMembers = pgTable("staff_members", {
  authUserId: text("auth_user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  capabilities: text("capabilities").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const children = pgTable(
  "children",
  {
    id: uuid("id").primaryKey(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => parents.id, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    avatarKey: text("avatar_key").notNull(),
    ageBand: text("age_band").notNull().$type<"5_7" | "8_10">(),
    status: text("status").notNull().default("active").$type<"active" | "suspended" | "deletion_pending">(),
    curriculumReleaseId: uuid("curriculum_release_id"),
    startingStageKey: text("starting_stage_key"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    sessionGoalMinutes: smallint("session_goal_minutes").notNull().default(5),
    quietCelebrations: boolean("quiet_celebrations").notNull().default(false),
    reducedMotion: boolean("reduced_motion").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("children_id_parent_unique").on(t.id, t.parentId),
    index("children_parent_idx").on(t.parentId, t.status),
    check("children_nickname_length", sql`char_length(${t.nickname}) between 1 and 30`),
    check("children_avatar_key_format", sql`${t.avatarKey} ~ '^[a-z0-9_-]{1,64}$'`),
    check("children_age_band_domain", sql`${t.ageBand} in ('5_7','8_10')`),
    check(
      "children_status_domain",
      sql`${t.status} in ('active','suspended','deletion_pending')`,
    ),
    check(
      "children_goal_domain",
      sql`${t.sessionGoalMinutes} in (5,10,15)`,
    ),
  ],
);

export const sessionControls = pgTable(
  "session_controls",
  {
    authSessionId: text("auth_session_id").primaryKey(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => parents.id, { onDelete: "cascade" }),
    mode: text("mode").notNull().default("parent").$type<"parent" | "child">(),
    activeChildId: uuid("active_child_id"),
    adultGateUntil: timestamp("adult_gate_until", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    // Ownership: the selected active child must belong to this parent.
    // Composite FK added in custom migration (drizzle circular self-arg limitation).
    check("session_controls_mode_domain", sql`${t.mode} in ('parent','child')`),
    check(
      "session_controls_child_mode_shape",
      sql`${t.mode} <> 'child' or (${t.activeChildId} is not null and ${t.adultGateUntil} is null)`,
    ),
  ],
);

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => parents.id, { onDelete: "cascade" }),
    childId: uuid("child_id"),
    scope: text("scope").notNull().$type<"family" | "child">(),
    purpose: text("purpose").notNull().default("profile_learning"),
    action: text("action").notNull().$type<"grant" | "withdraw">(),
    noticeVersion: text("notice_version").notNull(),
    policyVersion: text("policy_version").notNull(),
    assuranceMethod: text("assurance_method"),
    assuranceEvidenceReference: text("assurance_evidence_reference"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consent_latest_idx").on(t.parentId, t.childId, t.recordedAt.desc()),
    check("consent_scope_shape", sql`(${t.scope} = 'family' and ${t.childId} is null) or (${t.scope} = 'child' and ${t.childId} is not null)`),
    check("consent_grant_needs_assurance", sql`${t.action} <> 'grant' or (${t.assuranceMethod} is not null and ${t.assuranceEvidenceReference} is not null)`),
    check("consent_purpose_domain", sql`${t.purpose} = 'profile_learning'`),
  ],
);

export const parentAssessments = pgTable(
  "parent_assessments",
  {
    id: uuid("id").primaryKey(),
    childId: uuid("child_id").notNull(),
    parentId: uuid("parent_id").notNull(),
    chapterNumber: smallint("chapter_number").notNull(),
    status: text("status").notNull().$type<"needs_practice" | "developing" | "parent_confirmed">(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("parent_assessments_latest_idx").on(t.childId, t.chapterNumber, t.observedAt.desc()),
    check("assessments_chapter_range", sql`${t.chapterNumber} between 1 and 114`),
    check(
      "assessments_status_domain",
      sql`${t.status} in ('needs_practice','developing','parent_confirmed')`,
    ),
  ],
);

export const stageOverrides = pgTable(
  "stage_overrides",
  {
    childId: uuid("child_id").notNull(),
    parentId: uuid("parent_id").notNull(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    reason: text("reason").notNull().$type<"parent_selected_start" | "guided_review">(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.childId, t.lessonId] }),
    check("stage_overrides_reason_domain", sql`${t.reason} in ('parent_selected_start','guided_review')`),
  ],
);

export const dailyActivity = pgTable(
  "daily_activity",
  {
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    localDate: text("local_date").notNull(), // ISO date in profile timezone snapshot
    timezoneSnapshot: text("timezone_snapshot").notNull(),
    estimatedActiveMs: bigint("estimated_active_ms", { mode: "number" }).notNull().default(0),
    completedSessions: integer("completed_sessions").notNull().default(0),
    firstAnswers: integer("first_answers").notNull().default(0),
    correctFirstAnswers: integer("correct_first_answers").notNull().default(0),
  },
  (t) => [
    unique("daily_activity_unique").on(t.childId, t.localDate, t.timezoneSnapshot),
    check("daily_activity_nonnegative", sql`${t.estimatedActiveMs} >= 0 and ${t.completedSessions} >= 0 and ${t.firstAnswers} >= 0 and ${t.correctFirstAnswers} >= 0`),
    check("daily_activity_correct_le_first", sql`${t.correctFirstAnswers} <= ${t.firstAnswers}`),
  ],
);
