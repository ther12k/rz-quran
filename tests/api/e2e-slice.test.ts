// T025 core: adult setup → child lesson → finish → parent report on a real
// local PostgreSQL database. Run via `bun run test:integration`.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestApp, makeClient, signUpVerifiedParent, DEMO_LESSON_ID, DEMO_LESSON_UNITS, type TestApp } from "./setup.ts";

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.destroy();
});

describe("M1 end-to-end safe slice", () => {
  it("runs the full journey", async () => {
    const parent = await signUpVerifiedParent(app.app, app, app.baseUrl, "e2e@example.com");

    // 1. Gate unlock (verified adult, correct password).
    const gate = await parent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    expect(gate.status).toBe(200);
    expect(gate.json.mode).toBe("parent");
    expect(gate.json.parent_gate_until).toBeTruthy();

    // 2. Consent requires the demo assurance token.
    const badConsent = await parent.call("POST", "/api/v1/parent/consents", {
      body: {
        action: "grant",
        scope: "family",
        child_id: null,
        purpose: "profile_learning",
        notice_version: "demo-notice-1",
        policy_version: "demo-policy-1",
        assurance_token: "wrong-token",
      },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(badConsent.status).toBe(403);
    expect(badConsent.json.error.code).toBe("ELIGIBILITY_BLOCKED");

    const consent = await parent.call("POST", "/api/v1/parent/consents", {
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
    expect(consent.status).toBe(201);

    // 3. Create child profile.
    const child = await parent.call("POST", "/api/v1/parent/children", {
      body: { nickname: "Aisyah", avatar_key: "cat_green", age_band: "5_7" },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(child.status).toBe(201);
    const childId = child.json.id as string;

    // 4. Enter child mode (clears the gate atomically).
    const enter = await parent.call("POST", `/api/v1/parent/children/${childId}/enter`, { body: {} });
    expect(enter.status).toBe(200);
    const me = await parent.call("GET", "/api/v1/me");
    expect(me.json.mode).toBe("child");
    expect(me.json.active_child_nickname).toBe("Aisyah");
    expect(me.json.parent_gate_until).toBeNull();

    // 5. Catalog shows the clearly-marked demo lesson only.
    const catalog = await parent.call("GET", "/api/v1/catalog");
    expect(catalog.status).toBe(200);
    expect(catalog.json.items).toHaveLength(1);
    expect(catalog.json.items[0].demo_only).toBe(true);
    expect(catalog.json.items[0].practice.required_units).toBe(3);

    // Lesson DTO leaks no answer data.
    const lesson = await parent.call("GET", `/api/v1/lessons/${DEMO_LESSON_ID}`);
    expect(lesson.status).toBe(200);
    const serialized = JSON.stringify(lesson.json);
    expect(serialized).not.toContain("correct_option_id");
    expect(serialized).not.toContain("explanation");
    expect(serialized).not.toContain("options");

    // 6. Start session; public question has options but no correct marker.
    const session = await parent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: DEMO_LESSON_ID },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(session.status).toBe(201);
    const sid = session.json.session_id as string;
    expect(session.json.current_question.options.length).toBe(3);
    expect(JSON.stringify(session.json.current_question)).not.toContain("correct");

    // 7. Ordered events: heartbeat anchor, letter acknowledgments.
    const events = await parent.call("POST", `/api/v1/learning/sessions/${sid}/events`, {
      body: {
        events: [
          { event_id: crypto.randomUUID(), sequence: 1, client_at: null, type: "heartbeat", active_ms: 14000 },
          { event_id: crypto.randomUUID(), sequence: 2, client_at: null, type: "unit_acknowledged", unit_id: DEMO_LESSON_UNITS.letterBa },
          { event_id: crypto.randomUUID(), sequence: 3, client_at: null, type: "unit_acknowledged", unit_id: DEMO_LESSON_UNITS.letterAlif },
          { event_id: crypto.randomUUID(), sequence: 4, client_at: null, type: "heartbeat", active_ms: 15000 },
        ],
      },
    });
    expect(events.status).toBe(200);
    expect(events.json.last_sequence).toBe(4);

    // 8. Answer (server-scored), then acknowledge feedback unit.
    const questionId = session.json.current_question.question_id as string;
    const answer = await parent.call("POST", `/api/v1/learning/sessions/${sid}/answers`, {
      body: { event_id: crypto.randomUUID(), client_at: null, question_id: questionId, selected_option_id: "ba" },
    });
    expect(answer.status).toBe(200);
    expect(answer.json.correct).toBe(true);
    expect(answer.json.first_response).toBe(true);

    const ack = await parent.call("POST", `/api/v1/learning/sessions/${sid}/events`, {
      body: {
        events: [
          // The answer endpoint consumed sequence 5 (answers share the
          // session sequence stream; docs/05 §3), so the feedback
          // acknowledgment continues at 6.
          { event_id: crypto.randomUUID(), sequence: 6, client_at: null, type: "unit_acknowledged", unit_id: DEMO_LESSON_UNITS.choice },
        ],
      },
    });
    expect(ack.status).toBe(200);

    // 9. Finish: completion + exactly one star.
    const finish = await parent.call("POST", `/api/v1/learning/sessions/${sid}/finish`, { body: {} });
    expect(finish.status).toBe(200);
    expect(finish.json.status).toBe("completed");
    expect(finish.json.star_awarded).toBe(true);
    expect(finish.json.practice.percent).toBe(100);

    const finishReplay = await parent.call("POST", `/api/v1/learning/sessions/${sid}/finish`, { body: {} });
    expect(finishReplay.json.star_awarded).toBe(false);

    const childProgress = await parent.call("GET", "/api/v1/learning/progress");
    expect(childProgress.json.stars).toBe(1);

    // 10. Return to parent mode via reauthentication gate, read report.
    const reGate = await parent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    expect(reGate.status).toBe(200);
    expect(reGate.json.mode).toBe("parent");

    const report = await parent.call("GET", `/api/v1/parent/children/${childId}/progress`);
    expect(report.status).toBe(200);
    expect(report.json.lessons_completed).toBe(1);
    expect(report.json.lessons_total).toBe(1);
    expect(report.json.quiz_first_answers).toBe(1);
    expect(report.json.quiz_accuracy_percent).toBe(100);
    expect(report.json.daily.at(-1).completed_sessions).toBe(1);
    expect(report.json.daily).toHaveLength(7);
  });

  it("reports honest zero states before any activity", async () => {
    const parent = await signUpVerifiedParent(app.app, app, app.baseUrl, "empty@example.com");
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
    const child = await parent.call("POST", "/api/v1/parent/children", {
      body: { nickname: "Bocah", avatar_key: "star_yellow", age_band: "5_7" },
      idempotencyKey: crypto.randomUUID(),
    });
    const report = await parent.call("GET", `/api/v1/parent/children/${child.json.id}/progress`);
    expect(report.status).toBe(200);
    expect(report.json.lessons_completed).toBe(0);
    expect(report.json.quiz_accuracy_percent).toBeNull(); // zero denominator: "Belum ada kuis"
    expect(report.json.estimated_active_ms).toBe(0);
  });
});
