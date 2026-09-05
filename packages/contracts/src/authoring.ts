// Server-side authoring schemas mirroring contracts/lesson.schema.json and
// contracts/content-manifest.schema.json. Authoring payloads may contain
// correct_option_id; they must NEVER be serialized to child/public DTOs.
import { z } from "zod";

const optionSchema = z.object({
  option_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/),
  label: z.string().min(1).max(80),
});

const questionSchema = z.object({
  question_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  prompt: z.string().min(1),
  options: z.array(optionSchema).min(2).max(4),
  correct_option_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/),
  explanation: z.string().min(1),
  source_ids: z.array(z.string().uuid()),
});

const verseRefSchema = z.object({
  verse_key: z.string().regex(/^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}$/),
  source_id: z.string().uuid(),
});

const unitSchema = z.object({
  unit_id: z.string().uuid(),
  ordinal: z.number().int().min(1),
  unit_type: z.enum(["instruction", "letter", "ayah", "choice"]),
  required: z.boolean(),
  instruction: z.string().min(1),
  letter: z.string().min(1).max(16).optional(),
  verse_ref: verseRefSchema.optional(),
  question_id: z.string().uuid().optional(),
  audio_asset_id: z.string().uuid().nullable(),
});

export const authoringLessonSchema = z
  .object({
    schema_version: z.literal("1.0"),
    demo_only: z.boolean(),
    lesson_id: z.string().uuid(),
    version_id: z.string().uuid(),
    version_number: z.number().int().min(1),
    title: z.string().min(1),
    lesson_type: z.enum(["listening", "surah", "quiz", "game"]),
    stage_key: z.string().min(1),
    estimated_minutes: z.number().int().min(1).max(15),
    source_ids: z.array(z.string().uuid()),
    units: z.array(unitSchema).min(1),
    questions: z.array(questionSchema),
  })
  .superRefine((lesson, ctx) => {
    const ordinals = lesson.units.map((u) => u.ordinal);
    if (new Set(ordinals).size !== ordinals.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "unit ordinals must be unique" });
    }
    for (const unit of lesson.units) {
      if (unit.unit_type === "letter" && !unit.letter) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `letter unit ${unit.unit_id} requires letter` });
      }
      if (unit.unit_type === "ayah" && !unit.verse_ref) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `ayah unit ${unit.unit_id} requires verse_ref` });
      }
      if (unit.unit_type !== "ayah" && unit.verse_ref) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unit ${unit.unit_id} must not carry verse_ref` });
      }
    }
    for (const q of lesson.questions) {
      const unit = lesson.units.find((u) => u.unit_id === q.unit_id);
      if (!unit) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `question ${q.question_id} references unknown unit` });
        continue;
      }
      if (unit.unit_type !== "choice") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `question ${q.question_id} attached to non-choice unit`,
        });
      }
      const ids = q.options.map((o) => o.option_id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `question ${q.question_id} has duplicate option ids` });
      }
      if (!ids.includes(q.correct_option_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `question ${q.question_id} correct_option_id not among options`,
        });
      }
    }
    const choiceUnits = lesson.units.filter((u) => u.unit_type === "choice");
    for (const unit of choiceUnits) {
      if (!lesson.questions.some((q) => q.unit_id === unit.unit_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `choice unit ${unit.unit_id} has no question`,
        });
      }
    }
  });
export type AuthoringLesson = z.infer<typeof authoringLessonSchema>;

// content-manifest.schema.json mirror (metadata shape only; not rights proof).
export const sourceManifestSchema = z.object({
  schema_version: z.string(),
  demo_only: z.boolean(),
  source_id: z.string().uuid(),
  source_kind: z.enum([
    "quran_text",
    "quran_audio",
    "hijaiyah_audio",
    "translation",
    "illustration",
    "lesson_notes",
  ]),
  title: z.string().min(1),
  source_version: z.string().min(1),
  upstream_reference: z.string().nullable(),
  acquired_at: z.string().datetime(),
});
export type SourceManifest = z.infer<typeof sourceManifestSchema>;
