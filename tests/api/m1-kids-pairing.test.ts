// Kids-MVP staging-only native pairing tests (GDM-009):
// QA-16 happy path (challenge → allowlisted parent approval → one-use
// verifier-bound redemption, no profile data before approval, no refresh
// token); QA-17 abuse (wrong code/verifier, replay, expiry, poll flood,
// bounded attempts, lost receipt → restart pairing); QA-18 + GDM-004 P1–P5
// (production refusal at boot and per route, cross-environment token replay,
// stored-row audience binding, logout/deletion/revoke invalidation).
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { buildApp } from "../../apps/api/src/index.ts";
import { createTestApp, signUpVerifiedParent, type TestApp } from "./setup.ts";

const DEMO_LESSON = "00000000-0000-4000-8000-00000000d010";
const DEMO_VERSION = "00000000-0000-4000-8000-00000000d011";

let app: TestApp;
let parent: Awaited<ReturnType<typeof signUpVerifiedParent>>;
let childId = "";

/** PKCE-style S256 pair: 32 random bytes, base64url, no padding. */
function makeVerifier() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function seedParentAndChild() {
  parent = await signUpVerifiedParent(app.app, app, app.baseUrl, "parent@test.local");
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
    body: { nickname: "UjiNative", avatar_key: "leaf_mint", age_band: "5_7" },
    idempotencyKey: crypto.randomUUID(),
  });
  childId = childRes.json.id;
}

async function createPairing(ip = "10.1.1.1") {
  const { challenge } = makeVerifier();
  const res = await parent.call("POST", "/api/v1/kids/pairings", {
    body: { code_challenge: challenge, client_build_id: "godot-4.7.2-test" },
    headers: { "X-Forwarded-For": ip },
  });
  expect(res.status).toBe(201);
  return res.json as { pairing_id: string; human_code: string; expires_at: string; poll_interval_seconds: 5 };
}

/** Full staging flow up to (but not including) redemption. */
async function approvedPairing(ip = "10.1.1.2") {
  const pairing = await createPairing(ip);
  const approve = await parent.call("POST", "/api/v1/parent/kids/pairings/approve", {
    body: { pairing_id: pairing.pairing_id, code: pairing.human_code, child_id: childId, decision: "approve" },
    headers: { "X-Forwarded-For": ip },
  });
  expect(approve.status).toBe(200);
  return { pairing, approve };
}

async function redeem(pairingId: string, verifier: string, ip = "10.1.1.2") {
  return parent.call("POST", "/api/v1/kids/pairings/token", {
    body: { pairing_id: pairingId, code_verifier: verifier },
    headers: { "X-Forwarded-For": ip },
  });
}

beforeAll(async () => {
  app = await createTestApp({
    KIDS_MVP_ENABLED: "true",
    KIDS_PAIRING_ENABLED: "true",
    KIDS_PAIRING_PARENT_ALLOWLIST: "parent@test.local",
  });
  await seedParentAndChild();
});

afterAll(async () => {
  await app.destroy();
});

describe("GDM-009 staging pairing (QA-16)", () => {
  it("creates a verifier-bound pairing with an unambiguous 8-char code and no secrets echoed", async () => {
    const pairing = await createPairing("10.2.0.1");
    expect(pairing.human_code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(pairing.poll_interval_seconds).toBe(5);
    const row = await app.sql`select code_hash, code_challenge, status from kids_pairings where id = ${pairing.pairing_id}`;
    // Human code stored hashed only; challenge stored, verifier never seen.
    expect(row[0].status).toBe("pending");
    expect(row[0].code_hash).not.toBe(pairing.human_code);
    expect(String(row[0].code_hash)).toHaveLength(64);
  });

  it("rejects extra fields, malformed challenges and unknown pairings with bounded failures", async () => {
    const { challenge } = makeVerifier();
    const extra = await parent.call("POST", "/api/v1/kids/pairings", {
      body: { code_challenge: challenge, client_build_id: "x", injected: true },
    });
    expect(extra.status).toBe(400);

    const badChallenge = await parent.call("POST", "/api/v1/kids/pairings", {
      body: { code_challenge: "plain-secret" },
    });
    expect(badChallenge.status).toBe(400);

    const unknown = await redeem(crypto.randomUUID(), makeVerifier().verifier, "10.2.0.9");
    expect(unknown.status).toBe(404);
  });

  it("exposes no profile data before approval; approval is allowlisted, gated and owned", async () => {
    const { verifier, challenge } = makeVerifier();
    const created = await parent.call("POST", "/api/v1/kids/pairings", {
      body: { code_challenge: challenge },
      headers: { "X-Forwarded-For": "10.3.0.1" },
    });
    const pairingId = created.json.pairing_id;

    const pending = await redeem(pairingId, verifier, "10.3.0.1");
    expect(pending.status).toBe(200);
    // Exactly the pending marker: no nickname/id/grant hints pre-approval.
    expect(pending.json).toEqual({ status: "pending" });

    // Non-allowlisted parent cannot approve even with a valid code.
    const outsider = await signUpVerifiedParent(app.app, app, app.baseUrl, "outsider@test.local");
    await outsider.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    const notAllowed = await outsider.call("POST", "/api/v1/parent/kids/pairings/approve", {
      body: { pairing_id: pairingId, code: created.json.human_code, child_id: childId, decision: "approve" },
    });
    expect(notAllowed.status).toBe(403);
    expect(notAllowed.json.error.code).toBe("CAPABILITY_REQUIRED");

    // Approving a foreign profile is a neutral miss.
    const wrongChild = await parent.call("POST", "/api/v1/parent/kids/pairings/approve", {
      body: { pairing_id: pairingId, code: created.json.human_code, child_id: crypto.randomUUID(), decision: "approve" },
      headers: { "X-Forwarded-For": "10.3.0.1" },
    });
    expect(wrongChild.status).toBe(404);

    const approve = await parent.call("POST", "/api/v1/parent/kids/pairings/approve", {
      body: { pairing_id: pairingId, code: created.json.human_code, child_id: childId, decision: "approve" },
      headers: { "X-Forwarded-For": "10.3.0.1" },
    });
    expect(approve.status).toBe(200);
    expect(approve.json).toEqual({
      status: "approved",
      profile: { id: childId, nickname: "UjiNative" },
      grant_audience: "rzq-kids-staging",
    });

    // Redeem: one opaque 15-minute bearer grant, server-bound audience.
    const token = await redeem(pairingId, verifier, "10.3.0.1");
    expect(token.status).toBe(200);
    expect(token.json.status).toBe("approved");
    expect(token.json.token_type).toBe("Bearer");
    expect(token.json.audience).toBe("rzq-kids-staging");
    expect(token.json.expires_in).toBeLessThanOrEqual(900);
    expect(token.json.lesson_allowlist).toContain(DEMO_VERSION);
    expect(typeof token.json.access_token).toBe("string");
    // No refresh token, no persistent login in this MVP.
    expect(token.json.refresh_token).toBeUndefined();

    const grantRow = await app.sql`select token_hash, audience, minted_env, pairing_id from kids_grants where pairing_id = ${pairingId}`;
    expect(grantRow).toHaveLength(1);
    expect(grantRow[0].audience).toBe("rzq-kids-staging");
    expect(String(grantRow[0].token_hash)).not.toBe(token.json.access_token);
  });

  it("uses the grant on the same scoped lesson routes (catalog, session start, current)", async () => {
    const { pairingId, verifier } = await startAndApprove("10.4.0.1");
    const token = await redeem(pairingId, verifier, "10.4.0.1");
    expect(token.status).toBe(200);
    const bearer = { Authorization: `Bearer ${token.json.access_token}` };

    const current = await parent.call("GET", "/api/v1/learning/current", { headers: bearer });
    expect(current.status).toBe(200);
    expect(current.json.session).toBeNull();

    const catalog = await parent.call("GET", "/api/v1/catalog", { headers: bearer });
    expect(catalog.status).toBe(200);
    expect(catalog.json.items.some((i: { lesson_id: string }) => i.lesson_id === DEMO_LESSON)).toBe(true);

    const started = await parent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: DEMO_LESSON },
      idempotencyKey: crypto.randomUUID(),
      headers: bearer,
    });
    expect(started.status).toBe(201);
    expect(started.json.status).toBe("active");

    const after = await parent.call("GET", "/api/v1/learning/current", { headers: bearer });
    expect(after.json.session.session_id).toBe(started.json.session_id);

    // Transport isolation: the parent browser session is not in child mode
    // and must not inherit the grant's child context.
    const viaCookie = await parent.call("GET", "/api/v1/learning/current");
    expect(viaCookie.status).toBe(401);
  });
});

/** Deterministic helper: pairing whose verifier the test knows. */
async function startAndApprove(ip: string, child: string = childId) {
  const { verifier, challenge } = makeVerifier();
  const created = await parent.call("POST", "/api/v1/kids/pairings", {
    body: { code_challenge: challenge },
    headers: { "X-Forwarded-For": ip },
  });
  expect(created.status).toBe(201);
  const approve = await parent.call("POST", "/api/v1/parent/kids/pairings/approve", {
    body: { pairing_id: created.json.pairing_id, code: created.json.human_code, child_id: child, decision: "approve" },
    headers: { "X-Forwarded-For": ip },
  });
  expect(approve.status).toBe(200);
  return { pairingId: created.json.pairing_id as string, verifier };
}

describe("GDM-009 pairing abuse (QA-17)", () => {
  it("rejects wrong codes neutrally and throttles code-entry failures at 5/min", async () => {
    // A PENDING pairing: wrong codes bump the bounded attempt counter.
    const { challenge } = makeVerifier();
    const created = await parent.call("POST", "/api/v1/kids/pairings", {
      body: { code_challenge: challenge },
      headers: { "X-Forwarded-For": "10.6.0.1" },
    });
    const pairingId = created.json.pairing_id as string;
    const ip = { "X-Forwarded-For": "10.6.1.1" };
    for (let i = 0; i < 5; i++) {
      const res = await parent.call("POST", "/api/v1/parent/kids/pairings/approve", {
        body: { pairing_id: pairingId, code: "XXXXXXXX", child_id: childId, decision: "approve" },
        headers: ip,
      });
      expect(res.status).toBe(400);
      expect(res.json.error.code).toBe("PAIRING_INVALID");
    }
    const sixth = await parent.call("POST", "/api/v1/parent/kids/pairings/approve", {
      body: { pairing_id: pairingId, code: "XXXXXXXX", child_id: childId, decision: "approve" },
      headers: ip,
    });
    expect(sixth.status).toBe(429);
    expect(sixth.json.error.details.retry_after_seconds).toBeGreaterThan(0);
  });

  it("gives a neutral error for a wrong verifier and never reveals pairing state", async () => {
    const { pairingId, verifier } = await startAndApprove("10.6.2.1");
    const wrong = await redeem(pairingId, makeVerifier().verifier, "10.6.2.2");
    expect(wrong.status).toBe(400);
    expect(wrong.json).toEqual({
      error: expect.objectContaining({ code: "PAIRING_INVALID" }),
    });
    // State intact: the honest verifier still redeems afterwards.
    const ok = await redeem(pairingId, verifier, "10.6.2.3");
    expect(ok.status).toBe(200);
  });

  it("never issues a second token for the same pairing (replay + lost receipt)", async () => {
    const { pairingId, verifier } = await startAndApprove("10.6.3.1");
    const first = await redeem(pairingId, verifier, "10.6.3.1");
    expect(first.status).toBe(200);
    const replay = await redeem(pairingId, verifier, "10.6.3.2");
    expect(replay.status).toBe(400);
    expect(replay.json.error.code).toBe("PAIRING_INVALID");
    const rows = await app.sql`select id from kids_grants where pairing_id = ${pairingId}`;
    expect(rows).toHaveLength(1);
    // Lost receipt → restart pairing instead of re-issuing (platform-auth §5).
    const restarted = await startAndApprove("10.6.3.4");
    const secondGrant = await redeem(restarted.pairingId, restarted.verifier, "10.6.3.4");
    expect(secondGrant.status).toBe(200);
    // The new grant supersedes the old one: only one live grant per child.
    const live = await app.sql`select id from kids_grants where child_id = ${childId} and revoked_at is null`;
    expect(live).toHaveLength(1);
  });

  it("returns expired/denied states only to the correct verifier and stops polling floods", async () => {
    // Expiry: honest client learns "expired" and restarts.
    const { pairingId, verifier } = await startAndApprove("10.6.4.1");
    await app.sql`update kids_pairings set expires_at = now() - interval '1 minute', created_at = now() - interval '6 minutes' where id = ${pairingId}`;
    const expired = await redeem(pairingId, verifier, "10.6.4.1");
    expect(expired.status).toBe(200);
    expect(expired.json).toEqual({ status: "expired" });
    const expiredApprove = await parent.call("POST", "/api/v1/parent/kids/pairings/approve", {
      body: { pairing_id: pairingId, code: "AAAAAAAA", child_id: childId, decision: "approve" },
      headers: { "X-Forwarded-For": "10.6.4.9" },
    });
    expect(expiredApprove.status).toBe(404);

    // Bounded pairing-wide wrong-verifier attempts auto-deny the pairing.
    const doomed = await startAndApprove("10.6.4.2");
    for (let i = 0; i < 8; i++) {
      const res = await redeem(doomed.pairingId, makeVerifier().verifier, `10.6.4.${10 + i}`);
      expect(res.status).toBe(400);
    }
    const denied = await redeem(doomed.pairingId, doomed.verifier, "10.6.4.30");
    expect(denied.status).toBe(200);
    expect(denied.json).toEqual({ status: "denied" });
  });

  it("throttles poll floods per pairing and exposes the retry delay", async () => {
    const { verifier, challenge } = makeVerifier();
    const created = await parent.call("POST", "/api/v1/kids/pairings", {
      body: { code_challenge: challenge },
      headers: { "X-Forwarded-For": "10.6.5.1" },
    });
    const pairingId = created.json.pairing_id as string;
    // A pending pairing absorbs up to 3 correct polls per 5 s window.
    for (let i = 0; i < 3; i++) {
      const res = await redeem(pairingId, verifier, "10.6.5.1");
      expect(res.status).toBe(200);
      expect(res.json).toEqual({ status: "pending" });
    }
    const flood = await redeem(pairingId, verifier, "10.6.5.1");
    expect(flood.status).toBe(429);
    expect(flood.json.error.code).toBe("RATE_LIMITED");
    expect(flood.json.error.details.retry_after_seconds).toBe(5);
  });
});

describe("GDM-009 production rejection + invalidation (QA-18, P1–P5)", () => {
  it("P1: production refuses pairing issuance, and the flag refuses production boot", async () => {
    const prod = buildApp(undefined, {
      APP_ENV: "production",
      DATABASE_URL: "postgresql://rzq@db.prod.internal/rzq", // string check only
      AUTH_SECRET: "prod-secret-prod-secret-prod-1234",
      SMTP_URL: "smtp://mail.prod.internal:25",
      MAIL_FROM: "no-reply@rzq.invalid",
      PRODUCTION_CHILD_ENROLLMENT_ENABLED: "true",
      APPROVED_PRIVACY_POLICY_VERSION: "1.0.0",
      APPROVED_CONSENT_METHOD: "onsite",
    });
    const create = await prod.app.fetch(new Request("http://prod.local/api/v1/kids/pairings", { method: "POST", body: "{}" }));
    expect(create.status).toBe(404);
    const token = await prod.app.fetch(new Request("http://prod.local/api/v1/kids/pairings/token", { method: "POST", body: "{}" }));
    expect(token.status).toBe(404);
    const approve = await prod.app.fetch(new Request("http://prod.local/api/v1/parent/kids/pairings/approve", { method: "POST", body: "{}" }));
    expect(approve.status).toBe(404);

    expect(() =>
      buildApp(undefined, {
        APP_ENV: "production",
        DATABASE_URL: "postgresql://rzq@db.prod.internal/rzq",
        AUTH_SECRET: "prod-secret-prod-secret-prod-1234",
        SMTP_URL: "smtp://mail.prod.internal:25",
        MAIL_FROM: "no-reply@rzq.invalid",
        PRODUCTION_CHILD_ENROLLMENT_ENABLED: "true",
        APPROVED_PRIVACY_POLICY_VERSION: "1.0.0",
        APPROVED_CONSENT_METHOD: "onsite",
        KIDS_PAIRING_ENABLED: "true",
      }),
    ).toThrow(/KIDS_PAIRING_ENABLED/);
  });

  it("P2: a staging grant replayed at a production-configured app is 401 with no data", async () => {
    const started = await startAndApprove("10.7.1.1");
    const token = await redeem(started.pairingId, started.verifier, "10.7.1.1");
    expect(token.status).toBe(200);

    const prod = buildApp(undefined, {
      APP_ENV: "production",
      DATABASE_URL: "postgresql://rzq@db.prod.internal/rzq",
      AUTH_SECRET: "prod-secret-prod-secret-prod-1234",
      SMTP_URL: "smtp://mail.prod.internal:25",
      MAIL_FROM: "no-reply@rzq.invalid",
      PRODUCTION_CHILD_ENROLLMENT_ENABLED: "true",
      APPROVED_PRIVACY_POLICY_VERSION: "1.0.0",
      APPROVED_CONSENT_METHOD: "onsite",
    });
    const res = await prod.app.fetch(new Request("http://prod.local/api/v1/learning/current", {
      headers: { Authorization: `Bearer ${token.json.access_token}` },
    }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("UjiNative");
  });

  it("P4: audience is stored-row bound (tamper blocked by constraint) and env-bound", async () => {
    const { pairingId, verifier } = await startAndApprove("10.7.2.1");
    const token = await redeem(pairingId, verifier, "10.7.2.1");
    expect(token.status).toBe(200);

    // Audience tampering is impossible at the storage layer…
    await expect(
      app.sql`update kids_grants set audience = 'rzq-kids-prod' where pairing_id = ${pairingId}`,
    ).rejects.toThrow();
    // …but a cross-environment mismatch on the stored row rejects the token.
    await app.sql`update kids_grants set minted_env = 'staging' where pairing_id = ${pairingId}`;
    const res = await parent.call("GET", "/api/v1/learning/current", {
      headers: { Authorization: `Bearer ${token.json.access_token}` },
    });
    expect(res.status).toBe(401);
  });

  it("P5: revoke route, parent logout, profile deletion and expiry all invalidate independently", async () => {
    // (a) explicit parent revocation
    const a = await startAndApprove("10.7.3.1");
    const grantA = await redeem(a.pairingId, a.verifier, "10.7.3.1");
    expect(grantA.status).toBe(200);
    const revoke = await parent.call("POST", "/api/v1/parent/kids/pairings/revoke", { body: {} });
    expect(revoke.status).toBe(200);
    expect(revoke.json.revoked_grants).toBeGreaterThanOrEqual(1);
    const afterRevoke = await parent.call("GET", "/api/v1/learning/current", {
      headers: { Authorization: `Bearer ${grantA.json.access_token}` },
    });
    expect(afterRevoke.status).toBe(401);

    // (b) parent logout kills live grants (auth session-delete hook)
    const b = await startAndApprove("10.7.3.2");
    const grantB = await redeem(b.pairingId, b.verifier, "10.7.3.2");
    expect(grantB.status).toBe(200);
    const signOut = await parent.call("POST", "/api/auth/sign-out", { body: {} });
    expect(signOut.status).toBe(200);
    const afterLogout = await parent.call("GET", "/api/v1/learning/current", {
      headers: { Authorization: `Bearer ${grantB.json.access_token}` },
    });
    expect(afterLogout.status).toBe(401);

    // Re-sign-in for the remaining scenarios (new session, fresh parent gate).
    const again = await parent.call("POST", "/api/auth/sign-in/email", {
      body: { email: "parent@test.local", password: "kata-sandi-aman-123" },
    });
    expect(again.status).toBe(200);
    await parent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });

    // (c) grant expiry
    const c = await startAndApprove("10.7.3.3");
    const grantC = await redeem(c.pairingId, c.verifier, "10.7.3.3");
    expect(grantC.status).toBe(200);
    await app.sql`update kids_grants set expires_at = now() - interval '1 second', created_at = now() - interval '16 minutes' where pairing_id = ${c.pairingId}`;
    const afterExpiry = await parent.call("GET", "/api/v1/learning/current", {
      headers: { Authorization: `Bearer ${grantC.json.access_token}` },
    });
    expect(afterExpiry.status).toBe(401);

    // (d) profile deletion cascades the grant away (QA-35 restore-suppression
    // rides on the existing deletion suppression ledger recorded in the same
    // transaction as the deletion).
    const d = await startAndApprove("10.7.3.4");
    const grantD = await redeem(d.pairingId, d.verifier, "10.7.3.4");
    expect(grantD.status).toBe(200);
    await parent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    const del = await parent.call("DELETE", `/api/v1/parent/children/${childId}`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(del.status).toBe(200);
    const grantRows = await app.sql`select id from kids_grants where child_id = ${childId}`;
    expect(grantRows).toHaveLength(0);
    const afterDelete = await parent.call("GET", "/api/v1/learning/current", {
      headers: { Authorization: `Bearer ${grantD.json.access_token}` },
    });
    expect(afterDelete.status).toBe(401);
  });

  it("native self-revoke (logout) kills the bearer grant server-side", async () => {
    // Runs after the P5 deletion scenario, so use a fresh profile.
    const fresh = await parent.call("POST", "/api/v1/parent/children", {
      body: { nickname: "UjiLogout", avatar_key: "leaf_mint", age_band: "5_7" },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(fresh.status).toBe(201);
    const { pairingId, verifier } = await startAndApprove("10.7.5.1", fresh.json.id);
    const token = await redeem(pairingId, verifier, "10.7.5.1");
    expect(token.status).toBe(200);
    const bearer = { Authorization: `Bearer ${token.json.access_token}` };
    const revoke = await parent.call("POST", "/api/v1/kids/grants/revoke_current", { body: {}, headers: bearer });
    expect(revoke.status).toBe(200);
    expect(revoke.json).toEqual({ revoked: true });
    const after = await parent.call("GET", "/api/v1/learning/current", { headers: bearer });
    expect(after.status).toBe(401);
  });

  it("consent withdrawal blocks a live grant immediately (403, server-authoritative)", async () => {
    const child2 = await parent.call("POST", "/api/v1/parent/children", {
      body: { nickname: "UjiKedua", avatar_key: "leaf_mint", age_band: "5_7" },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(child2.status).toBe(201);
    const { pairingId, verifier } = await startAndApprove("10.7.4.1", child2.json.id);
    const token = await redeem(pairingId, verifier, "10.7.4.1");
    expect(token.status).toBe(200);
    await parent.call("POST", "/api/v1/parent/consents/withdraw", { body: { scope: "family", child_id: null } });
    const res = await parent.call("GET", "/api/v1/learning/current", {
      headers: { Authorization: `Bearer ${token.json.access_token}` },
    });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("CONSENT_REQUIRED");
  });
});
