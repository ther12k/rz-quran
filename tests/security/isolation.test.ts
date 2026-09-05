// Security negatives (T018/T025): ownership, gate expiry, child-mode auth
// bypass, profile limits, idempotency and replay conflicts.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestApp, makeClient, signUpVerifiedParent, DEMO_LESSON_ID, type TestApp } from "../api/setup.ts";

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.destroy();
});

async function grantFamilyConsent(client: ReturnType<typeof makeClient>) {
  await client.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
  const res = await client.call("POST", "/api/v1/parent/consents", {
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
  expect(res.status).toBe(201);
}

async function createChild(client: ReturnType<typeof makeClient>, nickname: string) {
  const res = await client.call("POST", "/api/v1/parent/children", {
    body: { nickname, avatar_key: "cat_green", age_band: "5_7" },
    idempotencyKey: crypto.randomUUID(),
  });
  return res;
}

describe("ownership isolation", () => {
  it("parent B cannot read, enter or report parent A's child by id substitution", async () => {
    const a = await signUpVerifiedParent(app.app, app, app.baseUrl, "a@example.com");
    const b = await signUpVerifiedParent(app.app, app, app.baseUrl, "b@example.com");
    await grantFamilyConsent(a);
    await grantFamilyConsent(b);
    const childA = await createChild(a, "Anak A");
    expect(childA.status).toBe(201);

    // b unlocks its own gate first so failures are ownership failures, not gate failures.
    const list = await b.call("GET", "/api/v1/parent/children");
    expect(list.status).toBe(200);
    expect(list.json.items).toHaveLength(0);

    const enter = await b.call("POST", `/api/v1/parent/children/${childA.json.id}/enter`, { body: {} });
    expect(enter.status).toBe(404); // same outward response as unknown object
    const report = await b.call("GET", `/api/v1/parent/children/${childA.json.id}/progress`);
    expect(report.status).toBe(404);
    const patch = await b.call("PATCH", `/api/v1/parent/children/${childA.json.id}`, { body: { nickname: "Diretas" } });
    expect(patch.status).toBe(404);
  });

  it("parent routes fail in child mode even with a valid adult cookie", async () => {
    const p = await signUpVerifiedParent(app.app, app, app.baseUrl, "mode@example.com");
    await grantFamilyConsent(p);
    const child = await createChild(p, "Anak Mode");
    await p.call("POST", `/api/v1/parent/children/${child.json.id}/enter`, { body: {} });

    const targets = [
      ["GET", "/api/v1/parent/children"],
      ["GET", `/api/v1/parent/children/${child.json.id}/progress`],
    ];
    for (const [method, path] of targets) {
      const res = await p.call(method, path);
      expect(res.status).toBe(403);
      expect(res.json.error.code).toBe("PARENT_GATE_REQUIRED");
    }

    // Mounted auth account-mutation routes are blocked in child mode (T014).
    const update = await p.call("PATCH", "/api/auth/update-user", { body: { name: "Hacked" } });
    expect(update.status).toBe(403);
    const pwChange = await p.call("POST", "/api/auth/change-password", {
      body: { newPassword: "new-password-12345", revokeOtherSessions: false },
    });
    expect(pwChange.status).toBe(403);
    // Safe exceptions remain available.
    const session = await p.call("GET", "/api/auth/get-session");
    expect(session.status).toBe(200);
  });

  it("expired gate returns a predictable error", async () => {
    const p = await signUpVerifiedParent(app.app, app, app.baseUrl, "expiry@example.com");
    await grantFamilyConsent(p);
    const until = new Date(Date.now() - 1000).toISOString();
    await app.sql`update session_controls set adult_gate_until = ${until}::timestamptz where auth_session_id in (select id from session order by created_at desc limit 1)`;
    const res = await p.call("GET", "/api/v1/parent/children");
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("PARENT_GATE_REQUIRED");
  });
});

describe("child profile limits", () => {
  it("rejects a fourth active profile", async () => {
    const p = await signUpVerifiedParent(app.app, app, app.baseUrl, "limit@example.com");
    await grantFamilyConsent(p);
    for (const nickname of ["Satu", "Dua", "Tiga"]) {
      const res = await createChild(p, nickname);
      expect(res.status).toBe(201);
    }
    const fourth = await createChild(p, "Empat");
    expect(fourth.status).toBe(400);
    expect(fourth.json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("idempotency and replay", () => {
  it("same key with different payload returns IDEMPOTENCY_CONFLICT", async () => {
    const p = await signUpVerifiedParent(app.app, app, app.baseUrl, "idem@example.com");
    await grantFamilyConsent(p);
    const key = crypto.randomUUID();
    const first = await p.call("POST", "/api/v1/parent/children", {
      body: { nickname: "Anak Idem", avatar_key: "cat_green", age_band: "5_7" },
      idempotencyKey: key,
    });
    expect(first.status).toBe(201);
    const replaySame = await p.call("POST", "/api/v1/parent/children", {
      body: { nickname: "Anak Idem", avatar_key: "cat_green", age_band: "5_7" },
      idempotencyKey: key,
    });
    expect(replaySame.status).toBe(201);
    expect(replaySame.json.id).toBe(first.json.id);
    const conflict = await p.call("POST", "/api/v1/parent/children", {
      body: { nickname: "Anak Lain", avatar_key: "cat_green", age_band: "5_7" },
      idempotencyKey: key,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.json.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("reused event id with different payload returns EVENT_ID_CONFLICT", async () => {
    const p = await signUpVerifiedParent(app.app, app, app.baseUrl, "replay@example.com");
    await grantFamilyConsent(p);
    const child = await createChild(p, "Anak Replay");
    await p.call("POST", `/api/v1/parent/children/${child.json.id}/enter`, { body: {} });
    const session = await p.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: DEMO_LESSON_ID },
      idempotencyKey: crypto.randomUUID(),
    });
    const sid = session.json.session_id;
    const eventId = crypto.randomUUID();
    const first = await p.call("POST", `/api/v1/learning/sessions/${sid}/events`, {
      body: { events: [{ event_id: eventId, sequence: 1, client_at: null, type: "heartbeat", active_ms: 1000 }] },
    });
    expect(first.status).toBe(200);
    const reused = await p.call("POST", `/api/v1/learning/sessions/${sid}/events`, {
      body: { events: [{ event_id: eventId, sequence: 2, client_at: null, type: "heartbeat", active_ms: 2000 }] },
    });
    expect(reused.status).toBe(409);
    expect(reused.json.error.code).toBe("EVENT_ID_CONFLICT");
  });

  it("child cannot start a session for another lesson while one is active", async () => {
    const p = await signUpVerifiedParent(app.app, app, app.baseUrl, "inuse@example.com");
    await grantFamilyConsent(p);
    const child = await createChild(p, "Anak InUse");
    await p.call("POST", `/api/v1/parent/children/${child.json.id}/enter`, { body: {} });
    const s1 = await p.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: DEMO_LESSON_ID },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(s1.status).toBe(201);
    // Same lesson returns the same session (resume).
    const resume = await p.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: DEMO_LESSON_ID },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(resume.json.session_id).toBe(s1.json.session_id);
  });

  it("wrong gate password is rejected without leaking account state", async () => {
    const p = await signUpVerifiedParent(app.app, app, app.baseUrl, "wrongpw@example.com");
    const res = await p.call("POST", "/api/v1/parent/gate", { body: { password: "salah-total-999" } });
    expect(res.status).toBe(401);
  });
});
