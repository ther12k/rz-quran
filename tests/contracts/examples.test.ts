// Contract tests (T007): bundled positive examples must validate; bundled
// invalid examples must fail. Mirrors contracts/README.md expectations.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  authoringLessonSchema,
  answerRequestSchema,
  consentRequestSchema,
  eventBatchSchema,
  progressEventSchema,
  sourceManifestSchema,
} from "@rzq/contracts";

const examplesDir = join(import.meta.dirname, "../../contracts/examples");

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(examplesDir, rel), "utf8"));
}

describe("bundled positive examples", () => {
  it("demo-hijaiyah-lesson.json validates as authoring lesson", () => {
    const parsed = authoringLessonSchema.safeParse(readJson("demo-hijaiyah-lesson.json"));
    expect(parsed.success).toBe(true);
  });

  it("source-manifest-demo.json validates as source manifest", () => {
    const parsed = sourceManifestSchema.safeParse(readJson("source-manifest-demo.json"));
    expect(parsed.success).toBe(true);
  });

  it("progress-batch.json validates as event batch", () => {
    const parsed = eventBatchSchema.safeParse(readJson("progress-batch.json"));
    expect(parsed.success).toBe(true);
  });
});

describe("bundled invalid examples", () => {
  const invalidDir = join(examplesDir, "invalid");
  const files = readdirSync(invalidDir);

  it("invalid directory contains fixtures", () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it("client-child-injection.json is rejected (no client-supplied child id)", () => {
    const parsed = progressEventSchema.safeParse(readJson("invalid/client-child-injection.json"));
    expect(parsed.success).toBe(false);
  });

  it("heartbeat-too-large.json is rejected (>15000ms)", () => {
    const parsed = progressEventSchema.safeParse(readJson("invalid/heartbeat-too-large.json"));
    expect(parsed.success).toBe(false);
  });
});

describe("DTO invariants beyond the bundled examples", () => {
  it("consent grant without assurance token is rejected", () => {
    const parsed = consentRequestSchema.safeParse({
      action: "grant",
      scope: "family",
      child_id: null,
      purpose: "profile_learning",
      notice_version: "demo-notice-1",
      policy_version: "demo-policy-1",
      assurance_token: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("child-scope consent with null child_id is rejected", () => {
    const parsed = consentRequestSchema.safeParse({
      action: "withdraw",
      scope: "child",
      child_id: null,
      purpose: "profile_learning",
      notice_version: "demo-notice-1",
      policy_version: "demo-policy-1",
      assurance_token: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("answer option ids follow the option_id grammar", () => {
    expect(
      answerRequestSchema.safeParse({
        event_id: crypto.randomUUID(),
        client_at: null,
        question_id: crypto.randomUUID(),
        selected_option_id: "UPPER-not-allowed",
      }).success,
    ).toBe(false);
  });
});
