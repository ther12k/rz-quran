// Transport DTO validation mirroring contracts/openapi.yaml components.
// These schemas describe UNTRUSTED client input and PUBLIC response shapes.
// Server-only fields (answer keys, reviewer notes) deliberately have no
// representation here.
import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const errorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    request_id: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

// --- /me and gate ---

export const meSchema = z.object({
  mode: z.enum(["parent", "child", "staff"]),
  email_verified: z.boolean(),
  parent_gate_until: z.string().datetime().nullable(),
  active_child_id: uuidSchema.nullable(),
  active_child_nickname: z.string().nullable(),
  eligibility_status: z.enum(["pending", "approved", "blocked"]),
  effective_consent: z.boolean(),
  staff_capabilities: z.array(z.string()),
});
export type Me = z.infer<typeof meSchema>;

export const gateRequestSchema = z.object({
  password: z.string().min(1).max(1024),
});

// --- consent ---

export const consentRequestSchema = z
  .object({
    action: z.enum(["grant", "withdraw"]),
    scope: z.enum(["family", "child"]),
    child_id: uuidSchema.nullable(),
    purpose: z.literal("profile_learning"),
    notice_version: z.string().min(1).max(80),
    policy_version: z.string().min(1).max(80),
    assurance_token: z.string().max(4000).nullable(),
  })
  .refine((v) => (v.scope === "family") === (v.child_id === null), {
    message: "family scope requires child_id null; child scope requires a child_id",
  })
  .refine((v) => v.action === "withdraw" || v.assurance_token !== null, {
    message: "grant requires an assurance token",
  });
export type ConsentRequest = z.infer<typeof consentRequestSchema>;

// --- children ---

export const avatarKeySchema = z.string().regex(/^[a-z0-9_-]{1,64}$/);

export const childCreateSchema = z.object({
  nickname: z.string().trim().min(1).max(30),
  avatar_key: avatarKeySchema,
  age_band: z.enum(["5_7", "8_10"]),
});
export type ChildCreate = z.infer<typeof childCreateSchema>;

export const childPatchSchema = z
  .object({
    nickname: z.string().trim().min(1).max(30).optional(),
    avatar_key: avatarKeySchema.optional(),
    age_band: z.enum(["5_7", "8_10"]).optional(),
  })
  .refine((v) => Object.keys(v).length >= 1, { message: "at least one field required" });

export const childSchema = z.object({
  id: uuidSchema,
  nickname: z.string(),
  avatar_key: z.string(),
  age_band: z.enum(["5_7", "8_10"]),
  status: z.enum(["active", "suspended", "deletion_pending"]),
  created_at: z.string().datetime(),
});

export const childListSchema = z.object({
  items: z.array(childSchema),
  next_cursor: z.string().nullable(),
});

// --- catalog / lessons (public, no answer keys) ---

export const practiceFractionSchema = z.object({
  completed_units: z.number().int().min(0),
  required_units: z.number().int().min(0),
  percent: z.number().min(0).max(100),
});

export const publicUnitSchema = z.object({
  unit_id: uuidSchema,
  ordinal: z.number().int().min(1),
  unit_type: z.enum(["instruction", "letter", "ayah", "choice"]),
  required: z.boolean(),
  instruction: z.string(),
  letter: z.string().nullable(),
  verse_ref: z
    .object({
      source_id: uuidSchema,
      verse_key: z.string().regex(/^[1-9][0-9]{0,2}:[1-9][0-9]{0,2}$/),
    })
    .nullable(),
  canonical_text: z.string().nullable(),
  audio_asset_id: uuidSchema.nullable(),
  question_id: uuidSchema.nullable(),
});

export const attributionSchema = z.object({
  source_title: z.string(),
  source_version: z.string(),
  attribution: z.string(),
  reciter_name: z.string().nullable(),
});

export const publicLessonSchema = z.object({
  lesson_id: uuidSchema,
  version_id: uuidSchema,
  title: z.string(),
  lesson_type: z.enum(["listening", "surah", "quiz", "game"]),
  demo_only: z.boolean(),
  units: z.array(publicUnitSchema),
  attributions: z.array(attributionSchema),
});
export type PublicLesson = z.infer<typeof publicLessonSchema>;

export const publicQuestionSchema = z.object({
  question_id: uuidSchema,
  unit_id: uuidSchema,
  prompt: z.string(),
  options: z
    .array(
      z.object({
        option_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/),
        label: z.string().min(1).max(80),
      }),
    )
    .min(2)
    .max(4),
});

export const lessonCardSchema = z.object({
  lesson_id: uuidSchema,
  version_id: uuidSchema,
  title: z.string(),
  lesson_type: z.enum(["listening", "surah", "quiz", "game"]),
  stage_key: z.string(),
  estimated_minutes: z.number().int().min(1).max(15),
  access: z.enum(["available", "locked"]),
  prerequisite_lesson_ids: z.array(uuidSchema),
  practice: practiceFractionSchema,
});

// --- learning sessions and events ---

export const startSessionSchema = z.object({
  lesson_id: uuidSchema,
});

export const learningSessionSchema = z.object({
  session_id: uuidSchema,
  lesson_id: uuidSchema,
  version_id: uuidSchema,
  status: z.enum(["active", "paused", "completed", "replaced", "expired", "recalled"]),
  last_sequence: z.number().int().min(0),
  completed_unit_ids: z.array(uuidSchema),
  current_question: publicQuestionSchema.nullable(),
  practice: practiceFractionSchema,
  estimated_active_ms: z.number().int().min(0),
  expires_at: z.string().datetime(),
});
export type LearningSessionDto = z.infer<typeof learningSessionSchema>;

// progress-event.schema.json mirror: untrusted client events.
export const progressEventSchema = z.discriminatedUnion("type", [
  z.object({
    event_id: uuidSchema,
    sequence: z.number().int().min(1),
    client_at: z.string().datetime().nullable(),
    type: z.literal("unit_acknowledged"),
    unit_id: uuidSchema,
  }),
  z.object({
    event_id: uuidSchema,
    sequence: z.number().int().min(1),
    client_at: z.string().datetime().nullable(),
    type: z.literal("heartbeat"),
    active_ms: z.number().int().min(0).max(15000),
  }),
  z.object({
    event_id: uuidSchema,
    sequence: z.number().int().min(1),
    client_at: z.string().datetime().nullable(),
    type: z.literal("paused"),
    reason: z.enum(["user", "hidden", "network"]),
  }),
  z.object({
    event_id: uuidSchema,
    sequence: z.number().int().min(1),
    client_at: z.string().datetime().nullable(),
    type: z.literal("resumed"),
  }),
]);
export type ProgressEvent = z.infer<typeof progressEventSchema>;

export const eventBatchSchema = z.object({
  events: z.array(progressEventSchema).min(1).max(20),
});

export const answerRequestSchema = z.object({
  event_id: uuidSchema,
  client_at: z.string().datetime().nullable(),
  question_id: uuidSchema,
  selected_option_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/),
});

export const finishResultSchema = z.object({
  session_id: uuidSchema,
  lesson_id: uuidSchema,
  status: z.enum(["completed", "replaced", "expired", "recalled"]),
  star_awarded: z.boolean(),
  practice: practiceFractionSchema,
});

// --- parent progress ---

export const dayActivitySchema = z.object({
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimated_active_ms: z.number().int().min(0),
  completed_sessions: z.number().int().min(0),
});

export const parentProgressSchema = z.object({
  child_id: uuidSchema,
  interval_days: z.number().int().min(1),
  timezone: z.string(),
  lessons_completed: z.number().int().min(0),
  lessons_total: z.number().int().min(0),
  distinct_surahs_practiced: z.number().int().min(0),
  quiz_first_answers: z.number().int().min(0),
  quiz_correct_first_answers: z.number().int().min(0),
  quiz_accuracy_percent: z.number().min(0).max(100).nullable(),
  estimated_active_ms: z.number().int().min(0),
  daily: z.array(dayActivitySchema),
  lessons: z.array(
    z.object({
      lesson_id: uuidSchema,
      title: z.string(),
      lesson_type: z.enum(["listening", "surah", "quiz", "game"]),
      completed: z.boolean(),
      practice: practiceFractionSchema,
      last_practiced_at: z.string().datetime().nullable(),
    }),
  ),
});
export type ParentProgress = z.infer<typeof parentProgressSchema>;
