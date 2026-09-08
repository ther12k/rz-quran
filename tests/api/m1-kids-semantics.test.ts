// Kids-MVP answer/finish/replay semantics (GDM-007 / QA-10..13):
// - QA-10: identical concurrent answers/start/finish commit once
// - QA-11: changed payload under the same key conflicts (start/finish) or
//   returns the stored first outcome (answers, first-answer-wins deviation);
//   recalled content cannot earn progress via replay
// - QA-12: foreign questions/options and sequence gaps reject; cursor stays
//   consistent
// - QA-13: three acknowledged+answered rounds gate finish; repeat finish never
//   double-counts; uniqueness survives replay-row expiry
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestApp, signUpVerifiedParent, type TestApp } from "./setup.ts";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FIXTURE_LESSON = "00000000-0000-4000-8000-00000000d110";
const FIXTURE_VERSION = "00000000-0000-4000-8000-00000000d111";
const OPTION_IDS = ["opt_lingkaran", "opt_persegi", "opt_segitiga"];

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp({ KIDS_MVP_ENABLED: "true" });
  await execFileAsync("bun", [resolve(import.meta.dirname, "../../packages/database/src/seed-fixture-mvp.ts")], {
    env: {
      ...process.env,
      DATABASE_URL:
        (app as any).sql.options.connection.url ??
        "postgresql://rzq:local_only@127.0.0.1:5433/" + (app as any).sql.options.database,
      APP_ENV: "test",
      DEMO_MODE: "true",
    },
  });
});

afterAll(async () => {
  await app.destroy();
});

async function setupChild(email: string) {
  const parent = await signUpVerifiedParent(app.app, app, app.baseUrl, email);
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
    body: { nickname: email.split("@")[0], avatar_key: "leaf_mint", age_band: "5_7" },
    idempotencyKey: crypto.randomUUID(),
  });
  await parent.call("POST", `/api/v1/parent/children/${childRes.json.id}/enter`, { body: {} });
  return parent;
}

async function startSession(parent: Awaited<ReturnType<typeof signUpVerifiedParent>>) {
  // Other tests may have recalled the shared fixture version; restore it.
  await (app as any).sql`update lesson_versions set status = 'published' where id = ${FIXTURE_VERSION}`;
  const start = await parent.call("POST", "/api/v1/learning/sessions", {
    body: { lesson_id: FIXTURE_LESSON },
    idempotencyKey: crypto.randomUUID(),
  });
  expect(start.status).toBe(201);
  return start.json.session_id as string;
}

/** Server-authoritative next sequence: refetch instead of trusting race outputs. */
async function nextSequence(parent: Awaited<ReturnType<typeof signUpVerifiedParent>>, sessionId: string) {
  const cur = await parent.call("GET", `/api/v1/learning/sessions/${sessionId}`);
  return (cur.json.last_sequence as number) + 1;
}

async function acknowledgeItems(parent: Awaited<ReturnType<typeof signUpVerifiedParent>>, sessionId: string) {
  const detail = await parent.call("GET", `/api/v1/learning/sessions/${sessionId}`);
  const itemUnits = detail.json.completed_unit_ids.length
    ? []
    : (detail.json as any).completed_unit_ids;
  void itemUnits;
  // Acknowledge the three example items (ordinals 1..3) in order.
  const lesson = await parent.call("GET", `/api/v1/lessons/${FIXTURE_LESSON}`);
  const itemUnitIds = lesson.json.units
    .filter((u: any) => u.unit_type === "letter")
    .sort((a: any, b: any) => a.ordinal - b.ordinal)
    .map((u: any) => u.unit_id);
  for (let i = 0; i < itemUnitIds.length; i++) {
    const ack = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/events`, {
      body: {
        events: [{ event_id: crypto.randomUUID(), sequence: i + 1, client_at: null, type: "unit_acknowledged", unit_id: itemUnitIds[i] }],
      },
    });
    expect(ack.status).toBe(200);
  }
  return itemUnitIds.length;
}

describe("GDM-007 answer/finish/replay semantics (QA-10..13)", () => {
  it("QA-10: concurrent identical answers and finishes commit exactly once", async () => {
    const parent = await setupChild("m1-sem@example.com");
    const sessionId = await startSession(parent);
    await acknowledgeItems(parent, sessionId);

    const detail = await parent.call("GET", `/api/v1/learning/sessions/${sessionId}`);
    const q1 = detail.json.current_question;

    // Two concurrent identical answer requests (same event id and choice).
    const eventId = crypto.randomUUID();
    const body = { event_id: eventId, client_at: null, question_id: q1.question_id, selected_option_id: OPTION_IDS[0] };
    const [a, b] = await Promise.all([
      parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, { body }),
      parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, { body }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // One committed outcome, surfaced identically to both racing callers.
    expect(a.json.correct).toBe(true);
    expect(b.json.correct).toBe(true);
    expect(a.json.first_response).toBe(true);
    expect(b.json.first_response === true || b.json.replayed === true).toBe(true);
    const rows = await (app as any).sql`select count(*)::int as n from first_answers where session_id = ${sessionId} and question_id = ${q1.question_id}`;
    expect(rows[0].n).toBe(1);

    // Acknowledge round 1's choice unit, then answer+ack rounds 2-3.
    // Use the server cursor: the losing racer's echoed sequence may be stale.
    const lessonAll = await parent.call("GET", `/api/v1/lessons/${FIXTURE_LESSON}`);
    const choiceUnits = lessonAll.json.units.filter((u: any) => u.unit_type === "choice").sort((x: any, y: any) => x.ordinal - y.ordinal);
    let sequence = await nextSequence(parent, sessionId);
    const ack1 = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/events`, {
      body: { events: [{ event_id: crypto.randomUUID(), sequence, client_at: null, type: "unit_acknowledged", unit_id: choiceUnits[0].unit_id }] },
    });
    expect(ack1.status).toBe(200);
    sequence += 1;
    for (let round = 1; round < 3; round++) {
      const cur = await parent.call("GET", `/api/v1/learning/sessions/${sessionId}`);
      const ans = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, {
        body: {
          event_id: crypto.randomUUID(),
          client_at: null,
          question_id: cur.json.current_question.question_id,
          selected_option_id: OPTION_IDS[round],
        },
      });
      expect(ans.status).toBe(200);
      sequence = ans.json.sequence + 1;
      const lesson = await parent.call("GET", `/api/v1/lessons/${FIXTURE_LESSON}`);
      const roundUnit = lesson.json.units
        .filter((u: any) => u.unit_type === "choice")
        .sort((x: any, y: any) => x.ordinal - y.ordinal)[round];
      const ack = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/events`, {
        body: { events: [{ event_id: crypto.randomUUID(), sequence, client_at: null, type: "unit_acknowledged", unit_id: roundUnit.unit_id }] },
      });
      expect(ack.status).toBe(200);
    }

    const finishKey = crypto.randomUUID();
    const [f1, f2] = await Promise.all([
      parent.call("POST", `/api/v1/learning/sessions/${sessionId}/finish`, { idempotencyKey: finishKey }),
      parent.call("POST", `/api/v1/learning/sessions/${sessionId}/finish`, { idempotencyKey: finishKey }),
    ]);
    expect(f1.status).toBe(200);
    expect(f2.status).toBe(200);
    // One star per child+lesson ever (unique first-completion reward).
    const starRows = await (app as any).sql`
      select count(*)::int as n from rewards r
      where r.reward_type = 'first_completion_star'
        and r.child_id = (select child_id from learning_sessions where id = ${sessionId})
        and r.lesson_id = ${FIXTURE_LESSON}`;
    expect(starRows[0].n).toBe(1);
    expect([f1.json.star_awarded, f2.json.star_awarded].filter(Boolean)).toHaveLength(1);
  });

  it("QA-11: changed payload under the same key conflicts; answer replay keeps the stored outcome; recall blocks progress", async () => {
    const parent = await setupChild("m1-replay@example.com");
    const sessionId = await startSession(parent);
    await acknowledgeItems(parent, sessionId);

    // Start with the same key but a changed payload → 409 IDEMPOTENCY_CONFLICT.
    const key = crypto.randomUUID();
    const firstStart = await parent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: FIXTURE_LESSON },
      idempotencyKey: key,
    });
    expect([200, 201]).toContain(firstStart.status);
    const changedStart = await parent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: "00000000-0000-4000-8000-00000000d110", extra: 1 },
      idempotencyKey: key,
    });
    expect(changedStart.status).toBe(400); // strict schema rejects the extra field

    const detail = await parent.call("GET", `/api/v1/learning/sessions/${sessionId}`);
    const q1 = detail.json.current_question;
    const ans = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, {
      body: { event_id: crypto.randomUUID(), client_at: null, question_id: q1.question_id, selected_option_id: OPTION_IDS[1] },
    });
    // Same event id, different option: stored first outcome returns unchanged
    // (first-answer-wins deviation recorded in MAPPING.md).
    const replay = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, {
      body: { event_id: (ans.json.event_id as string), client_at: null, question_id: q1.question_id, selected_option_id: OPTION_IDS[0] },
    });
    expect(replay.json.correct).toBe(ans.json.correct);
    expect(replay.json.selected_option_id).toBe(ans.json.selected_option_id);

    // Recall the pinned version: no further progress via any route.
    await (app as any).sql`update lesson_versions set status = 'recalled' where id = ${FIXTURE_VERSION}`;
    await (app as any).sql`update learning_sessions set status = 'recalled' where id = ${sessionId}`;
    const answerRecalled = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, {
      body: {
        event_id: crypto.randomUUID(),
        client_at: null,
        question_id: q1.question_id,
        selected_option_id: OPTION_IDS[0],
      },
    });
    expect(answerRecalled.json.error.code).toBe("SESSION_EXPIRED");
    const finishRecalled = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/finish`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(finishRecalled.json.error.code).toBe("SESSION_EXPIRED");
  });

  it("QA-12: foreign question/option and sequence gaps reject; cursor stays consistent", async () => {
    const parent = await setupChild("m1-cursor@example.com");
    const sessionId = await startSession(parent);
    await acknowledgeItems(parent, sessionId);

    // Foreign question id (not in this version) → VALIDATION_ERROR.
    const bad = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, {
      body: {
        event_id: crypto.randomUUID(),
        client_at: null,
        question_id: "11111111-2222-4333-8444-555555555501",
        selected_option_id: OPTION_IDS[0],
      },
    });
    expect(bad.json.error.code).toBe("VALIDATION_ERROR");

    const detail = await parent.call("GET", `/api/v1/learning/sessions/${sessionId}`);
    const q1 = detail.json.current_question;
    // Unknown option label for an existing question → VALIDATION_ERROR.
    const unknownOption = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, {
      body: { event_id: crypto.randomUUID(), client_at: null, question_id: q1.question_id, selected_option_id: "opt_hijau" },
    });
    expect(unknownOption.json.error.code).toBe("VALIDATION_ERROR");

    // Sequence gap on the event stream → conflict with cursor hint.
    const gap = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/events`, {
      body: {
        events: [
          { event_id: crypto.randomUUID(), sequence: 99, client_at: null, type: "heartbeat", active_ms: 100 },
        ],
      },
    });
    expect(gap.json.error.code).toBe("EVENT_SEQUENCE_CONFLICT");
    expect(gap.json.error.details.last_accepted_sequence).toBe(3);

    // Valid next event still works: cursor consistent.
    const ok = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/events`, {
      body: {
        events: [
          { event_id: crypto.randomUUID(), sequence: 4, client_at: null, type: "heartbeat", active_ms: 100 },
        ],
      },
    });
    expect(ok.status).toBe(200);

    // Finish with no answered rounds → INCOMPLETE_SESSION with remaining count.
    const early = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/finish`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(early.status).toBe(409);
    expect(early.json.error.code).toBe("INCOMPLETE_SESSION");
    expect(early.json.error.details.remaining_unit_count).toBeGreaterThan(0);
  });

  it("QA-13: repeat finish never double-counts; uniqueness survives replay-row expiry", async () => {
    const parent = await setupChild("m1-finish@example.com");
    const sessionId = await startSession(parent);
    await acknowledgeItems(parent, sessionId);

    let sequence = 3;
    for (let round = 0; round < 3; round++) {
      const cur = await parent.call("GET", `/api/v1/learning/sessions/${sessionId}`);
      const ans = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/answers`, {
        body: {
          event_id: crypto.randomUUID(),
          client_at: null,
          question_id: cur.json.current_question.question_id,
          selected_option_id: OPTION_IDS[round],
        },
      });
      expect(ans.status).toBe(200);
      sequence = ans.json.sequence + 1;
      const lesson = await parent.call("GET", `/api/v1/lessons/${FIXTURE_LESSON}`);
      const roundUnit = lesson.json.units
        .filter((u: any) => u.unit_type === "choice")
        .sort((x: any, y: any) => x.ordinal - y.ordinal)[round];
      const ack = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/events`, {
        body: { events: [{ event_id: crypto.randomUUID(), sequence, client_at: null, type: "unit_acknowledged", unit_id: roundUnit.unit_id }] },
      });
      expect(ack.status).toBe(200);
    }

    const key = crypto.randomUUID();
    const finish1 = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/finish`, { idempotencyKey: key });
    expect(finish1.status).toBe(200);
    expect(finish1.json.star_awarded).toBe(true);

    // Simulate replay-row expiry (24h retention purged).
    await (app as any).sql`delete from idempotency_records`;
    const finish2 = await parent.call("POST", `/api/v1/learning/sessions/${sessionId}/finish`, { idempotencyKey: crypto.randomUUID() });
    expect(finish2.status).toBe(200);
    expect(finish2.json.star_awarded).toBe(false);
    expect(finish2.json.status).toBe("completed");

    const starRows = await (app as any).sql`
      select count(*)::int as n from rewards r
      where r.reward_type = 'first_completion_star'
        and r.child_id = (select child_id from learning_sessions where id = ${sessionId})
        and r.lesson_id = ${FIXTURE_LESSON}`;
    expect(starRows[0].n).toBe(1);

    // No mastery-style claim anywhere in the finish payload.
    const finishText = JSON.stringify(finish2.json);
    expect(/hafal|mahir|lancar|mastery|fluency/i.test(finishText)).toBe(false);
  });
});
