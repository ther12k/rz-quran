// Kids-MVP contract tests (GDM-003 / QA-03 + QA-04): bundled valid examples
// validate; bundled invalid examples reject; public projections are leak-proof
// (deep-strict: extra private keys fail); write payloads reject unknown fields;
// oversized/malformed input is bounded. Mirrors contracts/examples/kids-mvp/.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  kidsAnswerResponseSchema,
  kidsAnswerRequestStrictSchema,
  kidsBootstrapStrictSchema,
  kidsEventBatchStrictSchema,
  kidsErrorEnvelopeSchema,
  kidsPlaybackInfoSchema,
  kidsSessionStrictSchema,
  kidsStartSessionStrictSchema,
  KIDS_CONTRACT_VERSION,
} from "@rzq/contracts";

const examplesDir = join(import.meta.dirname, "../../contracts/examples/kids-mvp");

function readJson(kind: "valid" | "invalid", name: string): unknown {
  return JSON.parse(readFileSync(join(examplesDir, kind, name), "utf8"));
}

describe("kids-mvp valid examples (QA-03)", () => {
  it("bootstrap-fixture validates against the strict bootstrap projection", () => {
    const parsed = kidsBootstrapStrictSchema.safeParse(readJson("valid", "bootstrap-fixture.json"));
    expect(parsed.success).toBe(true);
  });

  it("session-reviewed-placeholder validates against the strict session projection", () => {
    const parsed = kidsSessionStrictSchema.safeParse(readJson("valid", "session-reviewed-placeholder.json"));
    expect(parsed.success).toBe(true);
  });

  it("answer-feedback validates against the strict answer response", () => {
    const parsed = kidsAnswerResponseSchema.safeParse(readJson("valid", "answer-feedback.json"));
    expect(parsed.success).toBe(true);
  });
});

describe("kids-mvp invalid examples (QA-03)", () => {
  it("unsupported contract version rejects", () => {
    const parsed = kidsBootstrapStrictSchema.safeParse(readJson("invalid", "bootstrap-unsupported-version.json"));
    expect(parsed.success).toBe(false);
  });

  it("extra private key inside a public option rejects (deep strict)", () => {
    const parsed = kidsSessionStrictSchema.safeParse(readJson("invalid", "session-extra-private-field.json"));
    expect(parsed.success).toBe(false);
  });

  it("too many options reject", () => {
    const parsed = kidsSessionStrictSchema.safeParse(readJson("invalid", "question-too-many-options.json"));
    expect(parsed.success).toBe(false);
  });

  it("answer response carrying an answer map rejects", () => {
    const parsed = kidsAnswerResponseSchema.safeParse(readJson("invalid", "answer-leaks-answer-map.json"));
    expect(parsed.success).toBe(false);
  });

  it("playback info without a valid asset id rejects", () => {
    const parsed = kidsPlaybackInfoSchema.safeParse(readJson("invalid", "playback-missing-asset-id.json"));
    expect(parsed.success).toBe(false);
  });
});

describe("public fixtures never contain an answer map (QA-03)", () => {
  const validFiles = readdirSync(join(examplesDir, "valid"));

  it("no valid fixture mentions correct_option_id or an answer key", () => {
    for (const name of validFiles) {
      const text = readFileSync(join(examplesDir, "valid", name), "utf8");
      expect(text.includes("correct_option_id"), name).toBe(false);
      expect(text.includes("answer_key"), name).toBe(false);
    }
  });
});

describe("write payload strictness and bounds (QA-04)", () => {
  const validAnswer = {
    event_id: "c3d4e5f6-7777-4a88-9b99-000000000003",
    client_at: null,
    question_id: "a1111111-2222-4c33-9d44-555555555501",
    selected_option_id: "opt_a",
  };

  it("answer write accepts the agreed shape", () => {
    expect(kidsAnswerRequestStrictSchema.safeParse(validAnswer).success).toBe(true);
  });

  it("answer write rejects extra private/derived fields", () => {
    expect(
      kidsAnswerRequestStrictSchema.safeParse({ ...validAnswer, profile_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" })
        .success,
    ).toBe(false);
    expect(kidsAnswerRequestStrictSchema.safeParse({ ...validAnswer, correct: true }).success).toBe(false);
  });

  it("answer write rejects malformed ids, path-like and oversized option ids", () => {
    expect(kidsAnswerRequestStrictSchema.safeParse({ ...validAnswer, question_id: "not-a-uuid" }).success).toBe(false);
    expect(
      kidsAnswerRequestStrictSchema.safeParse({ ...validAnswer, selected_option_id: "x".repeat(33) }).success,
    ).toBe(false);
    expect(
      kidsAnswerRequestStrictSchema.safeParse({ ...validAnswer, selected_option_id: "../etc/passwd" }).success,
    ).toBe(false);
  });

  it("start write rejects unknown fields, malformed and injection-like ids", () => {
    expect(kidsStartSessionStrictSchema.safeParse({ lesson_id: "0d9a4f50-6f2f-4e1a-9c1d-52b6f0a4e101" }).success).toBe(true);
    expect(
      kidsStartSessionStrictSchema.safeParse({
        lesson_id: "0d9a4f50-6f2f-4e1a-9c1d-52b6f0a4e101",
        mode: "reviewed_learning",
      }).success,
    ).toBe(false);
    expect(kidsStartSessionStrictSchema.safeParse({ lesson_id: "<script>alert(1)</script>" }).success).toBe(false);
  });

  it("oversized prompt in a public projection rejects", () => {
    const session = readJson("valid", "session-reviewed-placeholder.json") as Record<string, unknown>;
    const question = { ...(session.current_question as Record<string, unknown>) };
    question.prompt = "x".repeat(201);
    expect(kidsSessionStrictSchema.safeParse({ ...session, current_question: question }).success).toBe(false);
  });

  it("event batch rejects out-of-bounds heartbeats (existing strict union)", () => {
    const batch = {
      events: [
        {
          event_id: "c3d4e5f6-7777-4a88-9b99-000000000009",
          sequence: 1,
          client_at: null,
          type: "heartbeat",
          active_ms: 60000,
        },
      ],
    };
    expect(kidsEventBatchStrictSchema.safeParse(batch).success).toBe(false);
  });

  it("error envelope matches the ApiError shape and rejects extras", () => {
    expect(
      kidsErrorEnvelopeSchema.safeParse({
        error: { code: "SESSION_EXPIRED", message: "Sesi berakhir.", request_id: "req-1" },
      }).success,
    ).toBe(true);
    expect(
      kidsErrorEnvelopeSchema.safeParse({
        error: { code: "SESSION_EXPIRED", message: "Sesi berakhir.", request_id: "req-1", stack: "sensitive" },
      }).success,
    ).toBe(false);
  });

  it("contract version constant is the agreed literal", () => {
    expect(KIDS_CONTRACT_VERSION).toBe("1");
  });
});
