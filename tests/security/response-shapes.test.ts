// T060 runtime evidence (acceptance reconciliation): public/child responses
// and error envelopes must not leak private fields, secrets, answer keys, or
// stack traces — complementing the static source/bundle leak scans.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestApp, makeClient, signUpVerifiedParent, type TestApp } from "../api/setup.ts";

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.destroy();
});

// Keys that must never appear on non-staff surfaces. `email` bans the raw
// address (booleans like email_verified are fine); staff-only registry
// fields (license, source refs, hashes) belong to /admin only.
const FORBIDDEN_KEYS = [
  "password",
  "password_hash",
  "passwordHash",
  "secret",
  "email",
  "license_reference",
  "license",
  "permitted_uses",
  "upstream_reference",
  "rights_status",
  "sha256",
  "source_ids",
  "is_correct",
  "correct_answer",
  "correct_option",
  "answer_key",
  "stack",
  "trace",
] as const;

function findForbiddenKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findForbiddenKeys(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      (FORBIDDEN_KEYS as readonly string[]).includes(k) ? [`${path}.${k}`] : findForbiddenKeys(v, `${path}.${k}`),
    );
  }
  return [];
}

async function setupChildClient(email: string) {
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
  const child = await parent.call("POST", "/api/v1/parent/children", {
    body: { nickname: "Bocah Bentuk", avatar_key: "cat_green", age_band: "5_7" },
    idempotencyKey: crypto.randomUUID(),
  });
  await parent.call("POST", `/api/v1/parent/children/${child.json.id}/enter`);
  return { parent, childId: child.json.id as string };
}

describe("T060: runtime response shapes", () => {
  it("public and child surfaces contain no forbidden fields", async () => {
    const { parent, childId } = await setupChildClient("shapes-child@example.com");

    // Child-mode surfaces (parent routes are blocked in child mode by design).
    const childSurfaces: Array<{ name: string; res: { status: number; json: unknown } }> = [
      { name: "me(child-mode)", res: await parent.call("GET", "/api/v1/me") },
      { name: "catalog", res: await parent.call("GET", "/api/v1/catalog") },
      { name: "learning/current", res: await parent.call("GET", "/api/v1/learning/current") },
      { name: "learning/progress", res: await parent.call("GET", "/api/v1/learning/progress") },
    ];
    const catalogItem = (childSurfaces[1]!.res.json as { items: { lesson_id: string }[] }).items[0];
    childSurfaces.push({ name: "lesson-detail", res: await parent.call("GET", `/api/v1/lessons/${catalogItem.lesson_id}`) });

    for (const s of childSurfaces) {
      expect(s.res.status, s.name).toBe(200);
      expect(findForbiddenKeys(s.res.json), `${s.name} leaked`).toEqual([]);
    }

    // Return through the gate to parent mode for parent-area surfaces.
    const gate = await parent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    expect(gate.status).toBe(200);
    const parentSurfaces: Array<{ name: string; res: { status: number; json: unknown } }> = [
      { name: "parent-children", res: await parent.call("GET", "/api/v1/parent/children") },
      { name: "parent-progress", res: await parent.call("GET", `/api/v1/parent/children/${childId}/progress`) },
    ];
    for (const s of parentSurfaces) {
      expect(s.res.status, s.name).toBe(200);
      expect(findForbiddenKeys(s.res.json), `${s.name} leaked`).toEqual([]);
    }
  });

  it("error envelopes stay opaque: no stack traces, identifiers, or forbidden fields", async () => {
    const anon = makeClient(app.app, app.baseUrl);
    const unauth = await anon.call("GET", "/api/v1/me");
    expect(unauth.status).toBe(401);
    expect(Object.keys(unauth.json.error).sort()).toEqual(["code", "message", "request_id"]);
    expect(findForbiddenKeys(unauth.json)).toEqual([]);

    const { parent } = await setupChildClient("shapes-errors@example.com");
    // Parent routes are blocked in child mode even with a valid cookie.
    const childModeBlocked = await parent.call("GET", "/api/v1/parent/children");
    expect([401, 403]).toContain(childModeBlocked.status);
    expect(findForbiddenKeys(childModeBlocked.json)).toEqual([]);

    // Cross-owner child access returns the same shape as unknown objects
    // (checked from parent mode after passing the gate).
    await parent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    const stranger = await parent.call("GET", "/api/v1/parent/children/00000000-0000-4000-8000-000000000000/progress");
    expect(stranger.status).toBe(404);
    expect(findForbiddenKeys(stranger.json)).toEqual([]);

    // Validation errors carry field details but no secrets.
    const badBody = await parent.call("POST", "/api/v1/learning/sessions", { body: { lesson_id: 42 } });
    expect(badBody.status).toBeGreaterThanOrEqual(400);
    expect(findForbiddenKeys(badBody.json)).toEqual([]);

    for (const res of [unauth, childModeBlocked, stranger, badBody]) {
      const text = JSON.stringify(res.json);
      expect(text).not.toMatch(/at\s+\/.+\.ts:\d+/); // no stack frames
    }
  });
});
