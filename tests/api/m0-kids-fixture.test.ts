// Kids-MVP fixture integration tests (GDM-005 / QA-06):
// - fixture lesson is server-controlled (demo_only from DB, no client override)
// - exactly 3 display-only items + 3 deterministic rounds; no audio, no Arabic,
//   no recitation, no answer key in public projections
// - absent-content behavior fails closed (missing lesson, missing media)
// - honest parent summary: first-answer accuracy with denominator 3
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestApp, signUpVerifiedParent, type TestApp } from "./setup.ts";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
let app: TestApp;
let fixtureLessonId = "00000000-0000-4000-8000-00000000d110";

const OPTION_IDS = ["opt_lingkaran", "opt_persegi", "opt_segitiga"];

beforeAll(async () => {
  app = await createTestApp();
  await execFileAsync("bun", [resolve(import.meta.dirname, "../../packages/database/src/seed-fixture-mvp.ts")], {
    env: {
      ...process.env,
      DATABASE_URL:
        (app as any).sql.options.connection.url ?? "postgresql://rzq:local_only@127.0.0.1:5433/" + (app as any).sql.options.database,
      APP_ENV: "test",
      DEMO_MODE: "true",
    },
  });
});

afterAll(async () => {
  await app.destroy();
});

describe("GDM-005 fixture mode (QA-06)", () => {
  it("serves a server-controlled, visibly non-learning fixture with deterministic rounds", async () => {
    const parent = await signUpVerifiedParent(app.app, app, app.baseUrl, "m0-fixture@example.com");

    await parent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    await parent.call("POST", "/api/v1/parent/consents", {
      body: {
        action: "grant",
        scope: "family",
        child_id: null,
        purpose: "profile_learning",
        notice_version: "demo-notice-1",
        policy_version: "demo-policy-1",
        assurance_token: "demo-local-assurance",
      },
      idempotencyKey: crypto.randomUUID(),
    });
    const childRes = await parent.call("POST", "/api/v1/parent/children", {
      body: { nickname: "Fixture", avatar_key: "leaf_mint", age_band: "5_7" },
      idempotencyKey: crypto.randomUUID(),
    });
    const childId = childRes.json.id;
    await parent.call("POST", `/api/v1/parent/children/${childId}/enter`, { body: {} });

    // Server-controlled fixture marker: demo_only comes from the database.
    const catalog = await parent.call("GET", "/api/v1/catalog");
    expect(catalog.status).toBe(200);
    const fixture = catalog.json.items.find((i: any) => i.lesson_id === fixtureLessonId);
    expect(fixture).toBeDefined();
    expect(fixture.demo_only).toBe(true);
    expect(fixture.stage_key).toBe("fixture_engineering");
    expect(fixture.access).toBe("available");
    // No client-side mode override exists: arbitrary query params are ignored
    // and the marker stays server-derived.
    const catalogOverride = await parent.call("GET", "/api/v1/catalog?content_mode=reviewed_learning&demo_only=false");
    const fixtureOverride = catalogOverride.json.items.find((i: any) => i.lesson_id === fixtureLessonId);
    expect(fixtureOverride.demo_only).toBe(true);

    // Public projection carries no answer key and no audio.
    const detail = await parent.call("GET", `/api/v1/lessons/${fixtureLessonId}`);
    expect(detail.status).toBe(200);
    expect(detail.json.demo_only).toBe(true);
    expect(detail.json.units).toHaveLength(6);
    for (const unit of detail.json.units) {
      expect(unit.audio_asset_id).toBeNull();
    }
    expect(JSON.stringify(detail.json).includes("correct_option_id")).toBe(false);
    expect(JSON.stringify(detail.json).match(/[\u0600-\u06FF]/)).toBeNull();

    // Honest missing-content behavior: no fixture audio exists.
    const media = await parent.call("GET", `/api/v1/media/00000000-0000-4000-8000-00000000dead/playback`);
    expect(media.status).toBe(503);
    expect(media.json.error.code).toBe("MEDIA_UNAVAILABLE");

    // Unapproved/missing pack fails closed.
    const missing = await parent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: "00000000-0000-4000-8000-00000000beef" },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(missing.status).toBe(404);
    expect(missing.json.error.code).toBe("NOT_FOUND");

    // Deterministic three-round journey.
    const start = await parent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: fixtureLessonId },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(start.status).toBe(201);
    const session = start.json;
    expect(session.status).toBe("active");

    // Acknowledge the three example items (sequence 1..3).
    const itemUnitIds = detail.json.units
      .filter((u: any) => u.unit_type === "letter")
      .sort((a: any, b: any) => a.ordinal - b.ordinal)
      .map((u: any) => u.unit_id);
    expect(itemUnitIds).toHaveLength(3);
    let sequence = 0;
    for (const unitId of itemUnitIds) {
      sequence += 1;
      const ack = await parent.call("POST", `/api/v1/learning/sessions/${session.session_id}/events`, {
        body: {
          events: [{ event_id: crypto.randomUUID(), sequence, client_at: null, type: "unit_acknowledged", unit_id: unitId }],
        },
      });
      expect(ack.status).toBe(200);
    }

    // Rounds 1-2 correct first, round 3 wrong first (deterministic).
    const roundUnitIds = detail.json.units
      .filter((u: any) => u.unit_type === "choice")
      .sort((a: any, b: any) => a.ordinal - b.ordinal)
      .map((u: any) => u.unit_id);
    const expectedCorrect = [true, true, false];
    for (let round = 0; round < 3; round++) {
      const current = await parent.call("GET", `/api/v1/learning/sessions/${session.session_id}`);
      expect(current.json.current_question).not.toBeNull();

      const selected = expectedCorrect[round] ? OPTION_IDS[round] : OPTION_IDS[(round + 1) % 3];
      sequence += 1;
      const answer = await parent.call("POST", `/api/v1/learning/sessions/${session.session_id}/answers`, {
        body: {
          event_id: crypto.randomUUID(),
          client_at: null,
          question_id: current.json.current_question.question_id,
          selected_option_id: selected,
        },
      });
      expect(answer.status).toBe(200);
      expect(answer.json.correct).toBe(expectedCorrect[round]);
      expect(answer.json.first_response).toBe(true);
      // Every answers call consumes a server sequence slot (first-answer-wins
      // retries included); the client adopts the server-returned sequence.
      sequence = answer.json.sequence;
      // First answer stands: a distinct retry returns the stored outcome.
      const retry = await parent.call("POST", `/api/v1/learning/sessions/${session.session_id}/answers`, {
        body: {
          event_id: crypto.randomUUID(),
          client_at: null,
          question_id: current.json.current_question.question_id,
          selected_option_id: OPTION_IDS[(round + 2) % 3],
        },
      });
      expect(retry.json.correct).toBe(expectedCorrect[round]);
      expect(retry.json.first_response).toBe(false);
      sequence = retry.json.sequence + 1;
      const ack = await parent.call("POST", `/api/v1/learning/sessions/${session.session_id}/events`, {
        body: {
          events: [{ event_id: crypto.randomUUID(), sequence, client_at: null, type: "unit_acknowledged", unit_id: roundUnitIds[round] }],
        },
      });
      expect(ack.status).toBe(200);
    }

    const finish = await parent.call("POST", `/api/v1/learning/sessions/${session.session_id}/finish`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(finish.status).toBe(200);
    expect(finish.json.status).toBe("completed");
    expect(finish.json.star_awarded).toBe(true);

    // Honest parent summary: accuracy with denominator, fixture sessions included.
    // Re-opening the gate returns the session to parent mode (server-enforced).
    await parent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    const progress = await parent.call("GET", `/api/v1/parent/children/${childId}/progress?interval_days=7`);
    expect(progress.status).toBe(200);
    expect(progress.json.quiz_first_answers).toBe(3);
    expect(progress.json.quiz_correct_first_answers).toBe(2);
    expect(progress.json.quiz_accuracy_percent).toBe(67);
  });

  it("refuses to seed the fixture outside guarded environments", async () => {
    await expect(
      execFileAsync("bun", [resolve(import.meta.dirname, "../../packages/database/src/seed-fixture-mvp.ts")], {
        env: { ...process.env, DATABASE_URL: "postgresql://rzq:local_only@127.0.0.1:5433/postgres", APP_ENV: "production", DEMO_MODE: "true" },
      }),
    ).rejects.toThrow(/Refusing to seed MVP fixture/);
  });
});
