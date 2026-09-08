// Kids-MVP public contract (GDM-003): the agreed wire shapes consumed by the
// Godot client and the accessible HTML equivalent. Built strictly on the
// existing serializer output (apps/api/src/modules/learning.ts) — this module
// does not invent new server behavior. Deep-strict public projections reject
// unknown/extra keys (QA-03: no private key may ride along in a public DTO);
// write schemas are strict so extra fields fail fast.
//
// Deviations from docs/godot-mvp/contracts/api.md are recorded in the client
// repository (contracts/kids-mvp/MAPPING.md) per GDM-004: bootstrap is
// client-composed from /v1/me + /catalog + /learning/current; idempotency uses
// the Idempotency-Key header and answer event_id replay; sessions use the
// existing 24h TTL; first-answer-wins replay replaces 409 QUESTION_ALREADY_ANSWERED.
import { z } from "zod";
import {
  learningSessionSchema,
  lessonCardSchema,
  practiceFractionSchema,
  startSessionSchema,
  answerRequestSchema,
  eventBatchSchema,
  uuidSchema,
} from "./dto.ts";

/** Agreed MVP contract version; clients reject anything else (QA-03). */
export const KIDS_CONTRACT_VERSION = "1" as const;

export const kidsContractVersionSchema = z.literal(KIDS_CONTRACT_VERSION);

/** Server-derived content mode; never settable via query parameters. */
export const kidsContentModeSchema = z.enum(["fixture", "reviewed_learning"]);
export type KidsContentMode = z.infer<typeof kidsContentModeSchema>;

/** Effective child context as exposed by /v1/me in child mode. */
export const kidsProfileSchema = z.object({
  id: uuidSchema,
  nickname: z.string().min(1).max(64),
});

/** Catalog card plus the demo flag the catalog route actually emits. */
export const kidsLessonCardSchema = lessonCardSchema.extend({
  title: z.string().min(1).max(128),
  demo_only: z.boolean(),
});

/**
 * Client-composed bootstrap (GDM-004 decision): /v1/me + first available
 * catalog card + /learning/current, projected with the contract version and
 * server-derived content mode. No email, consent evidence, parent identity,
 * review records, or answer keys.
 */
export const kidsBootstrapSchema = z.object({
  contract_version: kidsContractVersionSchema,
  content_mode: kidsContentModeSchema,
  profile: kidsProfileSchema,
  lesson: kidsLessonCardSchema.nullable(),
  active_session: learningSessionSchema.nullable(),
  server_time: z.string().datetime(),
});
export type KidsBootstrap = z.infer<typeof kidsBootstrapSchema>;

/** Answer route response: outcome flags only — never which option was right.
 *  Strict: the serializer emits exactly these keys; anything more is a leak. */
export const kidsAnswerResponseSchema = z.strictObject({
  event_id: uuidSchema,
  sequence: z.number().int().min(1),
  question_id: uuidSchema,
  selected_option_id: answerRequestSchema.shape.selected_option_id,
  correct: z.boolean(),
  first_response: z.boolean(),
  replayed: z.boolean(),
});
export type KidsAnswerResponse = z.infer<typeof kidsAnswerResponseSchema>;

/** Playback info for one permitted asset (media route shape). */
export const kidsPlaybackInfoSchema = z.object({
  asset_id: uuidSchema,
  playback_url: z.string().min(1).max(256),
  duration_ms: z.number().int().min(0),
  mime_type: z.string().regex(/^[a-z]+\/[a-z0-9.+-]+$/),
});

// --- Deep-strict public projections (QA-03 leak boundary) -------------------

export const kidsOptionStrictSchema = z.strictObject({
  option_id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/),
  label: z.string().min(1).max(80),
});

export const kidsPublicQuestionStrictSchema = z.strictObject({
  question_id: uuidSchema,
  unit_id: uuidSchema,
  prompt: z.string().min(1).max(200),
  options: z.array(kidsOptionStrictSchema).min(2).max(4),
});

export const kidsSessionStrictSchema = z.strictObject({
  session_id: uuidSchema,
  lesson_id: uuidSchema,
  version_id: uuidSchema,
  status: z.enum(["active", "paused", "completed", "replaced", "expired", "recalled", "abandoned"]),
  last_sequence: z.number().int().min(0),
  completed_unit_ids: z.array(uuidSchema),
  current_question: kidsPublicQuestionStrictSchema.nullable(),
  practice: practiceFractionSchema,
  estimated_active_ms: z.number().int().min(0),
  expires_at: z.string().datetime(),
});
export type KidsSessionStrict = z.infer<typeof kidsSessionStrictSchema>;

export const kidsBootstrapStrictSchema = z.strictObject({
  contract_version: kidsContractVersionSchema,
  content_mode: kidsContentModeSchema,
  profile: kidsProfileSchema.strict(),
  lesson: kidsLessonCardSchema.strict(),
  active_session: kidsSessionStrictSchema.nullable(),
  server_time: z.string().datetime(),
});

// --- Strict write payloads (QA-03/QA-04: extra fields reject) ---------------

export const kidsStartSessionStrictSchema = startSessionSchema.strict();
export const kidsAnswerRequestStrictSchema = answerRequestSchema.strict();
export const kidsEventBatchStrictSchema = eventBatchSchema.strict();

/** Abandon response: idempotent termination outcome (GDM-006). */
export const kidsAbandonResponseSchema = z.strictObject({
  session_id: uuidSchema,
  status: z.string().min(1).max(32),
  abandoned: z.boolean(),
});

// --- Staging-only native pairing (GDM-009) ----------------------------------
// Server mounts these only outside production with KIDS_PAIRING_ENABLED=true.
// The staging audience `rzq-kids-staging` is bound server-side; nothing here
// is client-assertable. Verifier/token are base64url(SHA-256) style strings.

const base64urlSha256 = z.string().regex(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, unpadded
const buildId = z.string().regex(/^[a-zA-Z0-9._-]{1,64}$/);

/** Native → server: create a pairing (verifier stays native-side). */
export const kidsPairingCreateStrictSchema = z.strictObject({
  code_challenge: base64urlSha256,
  client_build_id: buildId.optional(),
});

/** Server → native: pairing created; the human code is shown to the parent. */
export const kidsPairingCreatedSchema = z.strictObject({
  pairing_id: uuidSchema,
  human_code: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/),
  expires_at: z.string().datetime(),
  poll_interval_seconds: z.literal(5),
});

/** Native → server: bounded poll with the verifier (S256 proof). */
export const kidsPairingTokenStrictSchema = z.strictObject({
  pairing_id: uuidSchema,
  code_verifier: base64urlSha256,
  client_build_id: buildId.optional(),
});

/** Poll outcome before redemption — no profile data rides on these. */
export const kidsPairingPollSchema = z.strictObject({
  status: z.enum(["pending", "denied", "expired"]),
});

/** One-use redemption: the only moment profile data crosses to native. */
export const kidsGrantRedemptionSchema = z.strictObject({
  status: z.literal("approved"),
  access_token: z.string().min(43).max(86),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().min(1).max(900),
  audience: z.literal("rzq-kids-staging"),
  profile: kidsProfileSchema.strict(),
  lesson_allowlist: z.array(uuidSchema),
  client_build_id: buildId.nullable(),
});

/** Parent (web, allowlisted, live gate) → server: approve or deny a pairing. */
export const kidsPairingApproveStrictSchema = z.strictObject({
  pairing_id: uuidSchema,
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/),
  child_id: uuidSchema,
  decision: z.enum(["approve", "deny"]),
});

export const kidsPairingApproveResponseSchema = z.strictObject({
  status: z.enum(["approved", "denied"]),
  profile: kidsProfileSchema.strict().nullable(),
  grant_audience: z.string().min(1).nullable(),
});

export const kidsPairingRevokeResponseSchema = z.strictObject({
  revoked_grants: z.number().int().min(0),
});

// --- Error envelope (existing ApiError shape) -------------------------------

export const kidsErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().min(1),
    message: z.string().min(1),
    request_id: z.string().min(1),
    details: z.unknown().optional(),
  }),
});
