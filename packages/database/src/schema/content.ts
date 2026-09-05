// Content records: immutable sources, assets, lessons, questions, reviews.
import { bigint, boolean, check, foreignKey, index, integer, jsonb, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { staffMembers } from "./identity.ts";

export const contentSources = pgTable("content_sources", {
  id: uuid("id").primaryKey(),
  sourceKind: text("source_kind")
    .notNull()
    .$type<"quran_text" | "quran_audio" | "hijaiyah_audio" | "translation" | "illustration" | "lesson_notes">(),
  title: text("title").notNull(),
  sourceVersion: text("source_version").notNull(),
  upstreamReference: text("upstream_reference"),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull(),
  demoOnly: boolean("demo_only").notNull().default(false),
  rightsStatus: text("rights_status")
    .notNull()
    .default("pending")
    .$type<"pending" | "approved" | "denied" | "revoked">(),
  permittedUses: text("permitted_uses").array().notNull().default(sql`'{}'::text[]`),
  licenseReference: text("license_reference"),
  attribution: text("attribution").notNull().default(""),
  evidenceObjectKey: text("evidence_object_key"),
  rawObjectKey: text("raw_object_key"),
  rawSha256: text("raw_sha256"),
  registeredBy: text("registered_by")
    .notNull()
    .references(() => staffMembers.authUserId),
  reviewedBy: text("reviewed_by").references(() => staffMembers.authUserId),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => contentSources.id),
  objectKey: text("object_key").notNull().unique(),
  kind: text("kind").notNull().$type<"audio" | "image" | "source_file">(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  sha256: text("sha256"),
  durationMs: integer("duration_ms"),
  status: text("status").notNull().default("quarantine").$type<"quarantine" | "verified" | "blocked">(),
  deliveryPolicy: text("delivery_policy").notNull().default("none").$type<"none" | "stream" | "public_illustration">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const canonicalChapters = pgTable(
  "canonical_chapters",
  {
    sourceId: uuid("source_id")
      .notNull()
      .references(() => contentSources.id),
    chapterNumber: smallint("chapter_number").notNull(),
    latinTitle: text("latin_title").notNull(),
    verseCount: smallint("verse_count").notNull(),
  },
  (t) => [unique("canonical_chapters_pk").on(t.sourceId, t.chapterNumber)],
);

export const canonicalVerses = pgTable(
  "canonical_verses",
  {
    sourceId: uuid("source_id").notNull(),
    verseKey: text("verse_key").notNull(),
    chapterNumber: smallint("chapter_number").notNull(),
    ayahNumber: smallint("ayah_number").notNull(),
    canonicalText: text("canonical_text").notNull(),
    sha256: text("sha256").notNull(),
  },
  (t) => [
    unique("canonical_verses_pk").on(t.sourceId, t.verseKey),
    unique("canonical_verses_chapter_ayah").on(t.sourceId, t.chapterNumber, t.ayahNumber),
    foreignKey({
      name: "canonical_verses_chapter_fk",
      columns: [t.sourceId, t.chapterNumber],
      foreignColumns: [canonicalChapters.sourceId, canonicalChapters.chapterNumber],
    }),
    check("canonical_verses_ayah_positive", sql`${t.ayahNumber} > 0`),
    check("canonical_verses_text_present", sql`length(${t.canonicalText}) > 0`),
    check("canonical_verses_key_shape", sql`${t.verseKey} = ${t.chapterNumber}::text || ':' || ${t.ayahNumber}::text`),
    check("canonical_verses_hash_format", sql`${t.sha256} ~ '^[a-f0-9]{64}$'`),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey(),
    stableKey: text("stable_key").notNull().unique(),
    currentVersionId: uuid("current_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "lessons_current_version_fk",
      columns: [t.currentVersionId, t.id],
      foreignColumns: [lessonVersions.id, lessonVersions.lessonId],
    }),
    check("lessons_stable_key_format", sql`${t.stableKey} ~ '^[a-z0-9][a-z0-9_-]{0,63}$'`),
  ],
);

export const lessonVersions = pgTable(
  "lesson_versions",
  {
    id: uuid("id").primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    lessonType: text("lesson_type").notNull().$type<"listening" | "surah" | "quiz" | "game">(),
    stageKey: text("stage_key").notNull(),
    estimatedMinutes: smallint("estimated_minutes").notNull(),
    demoOnly: boolean("demo_only").notNull().default(false),
    sourceIds: uuid("source_ids").array().notNull().default(sql`'{}'::uuid[]`),
    status: text("status")
      .notNull()
      .default("draft")
      .$type<"draft" | "in_review" | "approved" | "published" | "retired" | "recalled">(),
    releaseHash: text("release_hash"),
    authorId: text("author_id")
      .notNull()
      .references(() => staffMembers.authUserId),
    reviewerId: text("reviewer_id").references(() => staffMembers.authUserId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    unique("lesson_versions_lesson_number").on(t.lessonId, t.versionNumber),
    unique("lesson_versions_id_lesson").on(t.id, t.lessonId),
    index("lesson_versions_status_idx").on(t.status, t.stageKey),
    check("lesson_versions_number_positive", sql`${t.versionNumber} > 0`),
    check("lesson_versions_minutes_range", sql`${t.estimatedMinutes} between 1 and 15`),
    check("lesson_versions_distinct_reviewer", sql`${t.reviewerId} is null or ${t.reviewerId} <> ${t.authorId}`),
    check(
      "lesson_versions_approved_shape",
      sql`${t.status} not in ('approved','published') or (${t.reviewerId} is not null and ${t.releaseHash} is not null)`,
    ),
  ],
);

export const lessonUnits = pgTable(
  "lesson_units",
  {
    id: uuid("id").primaryKey(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => lessonVersions.id),
    ordinal: integer("ordinal").notNull(),
    unitType: text("unit_type").notNull().$type<"instruction" | "letter" | "ayah" | "choice">(),
    required: boolean("required").notNull().default(true),
    instruction: text("instruction").notNull(),
    letter: text("letter"),
    verseSourceId: uuid("verse_source_id"),
    verseKey: text("verse_key"),
    audioAssetId: uuid("audio_asset_id").references(() => mediaAssets.id),
  },
  (t) => [
    unique("lesson_units_version_ordinal").on(t.versionId, t.ordinal),
    unique("lesson_units_id_version").on(t.id, t.versionId),
    foreignKey({
      name: "lesson_units_verse_fk",
      columns: [t.verseSourceId, t.verseKey],
      foreignColumns: [canonicalVerses.sourceId, canonicalVerses.verseKey],
    }),
    check("lesson_units_ordinal_positive", sql`${t.ordinal} > 0`),
    check("lesson_units_verse_pair", sql`(${t.verseSourceId} is null) = (${t.verseKey} is null)`),
    check("lesson_units_letter_shape", sql`${t.unitType} <> 'letter' or (${t.letter} is not null and char_length(${t.letter}) between 1 and 16)`),
    check("lesson_units_ayah_shape", sql`${t.unitType} <> 'ayah' or (${t.verseSourceId} is not null and ${t.verseKey} is not null)`),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey(),
    unitId: uuid("unit_id")
      .notNull()
      .unique()
      .references(() => lessonUnits.id),
    versionId: uuid("version_id").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").notNull().$type<{ option_id: string; label: string }[]>(),
    correctOptionId: text("correct_option_id").notNull(),
    explanation: text("explanation").notNull(),
    sourceIds: uuid("source_ids").array().notNull().default(sql`'{}'::uuid[]`),
  },
  (t) => [
    unique("questions_id_version").on(t.id, t.versionId),
    foreignKey({
      name: "questions_unit_fk",
      columns: [t.unitId, t.versionId],
      foreignColumns: [lessonUnits.id, lessonUnits.versionId],
    }),
    check("questions_options_count", sql`jsonb_array_length(${t.options}) between 2 and 4`),
  ],
);

export const contentReviews = pgTable("content_reviews", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id")
    .notNull()
    .references(() => lessonVersions.id),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => staffMembers.authUserId),
  decision: text("decision").notNull().$type<"approve" | "reject">(),
  releaseHash: text("release_hash").notNull(),
  checks: jsonb("checks").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const curriculumReleases = pgTable("curriculum_releases", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  versionNumber: integer("version_number").notNull(),
  definition: jsonb("definition").notNull(),
  status: text("status")
    .notNull()
    .default("draft")
    .$type<"draft" | "in_review" | "approved" | "published" | "retired" | "recalled">(),
  releaseHash: text("release_hash"),
  authorId: text("author_id")
    .notNull()
    .references(() => staffMembers.authUserId),
  reviewerId: text("reviewer_id").references(() => staffMembers.authUserId),
  reviewEvidence: jsonb("review_evidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const contentReports = pgTable("content_reports", {
  id: uuid("id").primaryKey(),
  parentId: uuid("parent_id").notNull(),
  versionId: uuid("version_id").notNull(),
  reason: text("reason").notNull().$type<"wrong_text" | "wrong_audio" | "unclear_instruction" | "other">(),
  note: text("note"),
  status: text("status").notNull().default("new").$type<"new" | "triaged" | "resolved">(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
