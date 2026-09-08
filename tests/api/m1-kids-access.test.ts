// Kids-MVP authorized access tests (GDM-006 + GDM-010):
// QA-07 cross-profile neutral failures; QA-08 release-state matrix
// (expired/recalled/unreviewed fail closed); QA-09 bounded media gateway
// (membership, bounds, no-store); abandon route incl. slot release;
// KIDS_MVP_ENABLED rollback switch; child idempotency deletion + replay purge.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createDatabase, schema } from "@rzq/database";
import { purgeExpiredIdempotency } from "../../apps/api/src/jobs/worker.ts";
import { createTestApp, signUpVerifiedParent, type TestApp } from "./setup.ts";

const execFileAsync = promisify(execFile);
const FIXTURE_LESSON = "00000000-0000-4000-8000-00000000d110";
const FIXTURE_VERSION = "00000000-0000-4000-8000-00000000d111";
const FIXTURE_SOURCE = "00000000-0000-4000-8000-00000000d101";
const ASSET_STREAMING = "00000000-0000-4000-8000-00000000d1f1";
const ASSET_FOREIGN = "00000000-0000-4000-8000-00000000d1f2";
const ASSET_QUARANTINE = "00000000-0000-4000-8000-00000000d1f3";
const ASSET_OVERSIZE = "00000000-0000-4000-8000-00000000d1f4";

let app: TestApp;
let appOff: TestApp;
let storageRoot: string;
let wavBytes: Buffer;
let wavSha256 = "";

function makeWavBytes(): Buffer {
  const sampleRate = 8000;
  const samples = 200;
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i++) buf.writeInt16LE(Math.round(3000 * Math.sin(i / 4)), 44 + i * 2);
  return buf;
}

async function seed(parent: Awaited<ReturnType<typeof signUpVerifiedParent>>, email: string) {
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
  const childId = childRes.json.id;
  await parent.call("POST", `/api/v1/parent/children/${childId}/enter`, { body: {} });
  return childId;
}

beforeAll(async () => {
  storageRoot = mkdtempSync(join(tmpdir(), "rzq-media-"));
  wavBytes = makeWavBytes();
  wavSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", wavBytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  writeFileSync(join(storageRoot, "tone1.wav"), wavBytes);

  app = await createTestApp({ KIDS_MVP_ENABLED: "true", MEDIA_STORAGE_ROOT: storageRoot });
  appOff = await createTestApp({});
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

  // Wire one fixture unit to a verified, streamable audio asset with real
  // bytes in the test storage root; other assets cover the negative matrix.
  await (app as any).sql`
    insert into media_assets (id, source_id, object_key, kind, mime_type, size_bytes, sha256, duration_ms, status, delivery_policy)
    values
      (${ASSET_STREAMING}, ${FIXTURE_SOURCE}, 'tone1.wav', 'audio', 'audio/wav', ${wavBytes.length}, ${wavSha256}, 1500, 'verified', 'stream'),
      (${ASSET_FOREIGN},   ${FIXTURE_SOURCE}, 'foreign.wav', 'audio', 'audio/wav', 100, null, 100, 'verified', 'stream'),
      (${ASSET_QUARANTINE}, ${FIXTURE_SOURCE}, 'quarantine.wav', 'audio', 'audio/wav', 100, null, 100, 'quarantine', 'stream'),
      (${ASSET_OVERSIZE},  ${FIXTURE_SOURCE}, 'oversize.wav', 'audio', 'audio/wav', ${5 * 1024 * 1024}, null, 100, 'verified', 'stream')
  `;
  await (app as any).sql`
    update lesson_units set audio_asset_id = ${ASSET_STREAMING} where id = '00000000-0000-4000-8000-00000000d1a1'
  `;
  await (app as any).sql`
    update lesson_units set audio_asset_id = ${ASSET_QUARANTINE} where id = '00000000-0000-4000-8000-00000000d1a2'
  `;
  await (app as any).sql`
    update lesson_units set audio_asset_id = ${ASSET_OVERSIZE} where id = '00000000-0000-4000-8000-00000000d1a3'
  `;
});

afterAll(async () => {
  await app.destroy();
  await appOff.destroy();
});

describe("GDM-006 authorized reads + GDM-010 persistence (QA-07/08/09 + QA-20)", () => {
  it("enforces ownership, release state and media bounds with neutral failures", async () => {
    const alice = await signUpVerifiedParent(app.app, app, app.baseUrl, "m1-alice@example.com");
    const aliceChildId = await seed(alice, "m1-alice@example.com");

    // Start with an idempotency key: creates a child-scoped replay row that
    // deletion must reach later.
    const startKey = crypto.randomUUID();
    const start = await alice.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: FIXTURE_LESSON },
      idempotencyKey: startKey,
    });
    expect(start.status).toBe(201);
    const aliceSession = start.json.session_id;

    // QA-09 success: bounded streaming of a permitted asset with no-store.
    // Binary body: read raw with the session cookie instead of the JSON helper.
    const streamRes = await app.app.handle(
      new Request(`http://test.local/api/v1/media/stream/${ASSET_STREAMING}?session_id=${aliceSession}`, {
        headers: { cookie: alice.cookie },
      }),
    );
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get("content-type")).toBe("audio/wav");
    expect(streamRes.headers.get("cache-control")).toBe("no-store");
    expect(streamRes.headers.get("x-content-sha256")).toBe(wavSha256);
    expect(new Uint8Array(await streamRes.arrayBuffer())).toEqual(new Uint8Array(wavBytes));

    // QA-09 negatives: unlinked asset, unreviewed asset, oversize asset.
    const foreign = await alice.call("GET", `/api/v1/media/stream/${ASSET_FOREIGN}?session_id=${aliceSession}`);
    expect(foreign.status).toBe(404);
    const quarantine = await alice.call("GET", `/api/v1/media/stream/${ASSET_QUARANTINE}?session_id=${aliceSession}`);
    expect(quarantine.status).toBe(503);
    expect(quarantine.json.error.code).toBe("MEDIA_UNAVAILABLE");
    const oversize = await alice.call("GET", `/api/v1/media/stream/${ASSET_OVERSIZE}?session_id=${aliceSession}`);
    expect(oversize.status).toBe(503);
    const badSession = await alice.call("GET", `/api/v1/media/stream/${ASSET_STREAMING}?session_id=not-a-uuid`);
    expect(badSession.status).toBe(400);

    // QA-07: a second parent gets neutral failures on Alice's resources.
    const mallory = await signUpVerifiedParent(app.app, app, app.baseUrl, "m1-mallory@example.com");
    await seed(mallory, "m1-mallory@example.com");
    const malloryStart = await mallory.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: FIXTURE_LESSON },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(malloryStart.status).toBe(201);
    const mallorySession = malloryStart.json.session_id;

    const crossSession = await mallory.call("GET", `/api/v1/learning/sessions/${aliceSession}`);
    expect(crossSession.status).toBe(404);
    const crossAbandon = await mallory.call("POST", `/api/v1/learning/sessions/${aliceSession}/abandon`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(crossAbandon.status).toBe(404);
    const crossMedia = await mallory.call("GET", `/api/v1/media/stream/${ASSET_STREAMING}?session_id=${aliceSession}`);
    expect(crossMedia.status).toBe(404);
    // Note: Mallory's own session shares the fixture version, so the streaming
    // asset legitimately serves for HER session — version-scoped membership is
    // the contract. Cross-profile access is denied at the session lookup above.

    // Abandon: happy path frees the one-writable-session slot.
    const abandon = await alice.call("POST", `/api/v1/learning/sessions/${aliceSession}/abandon`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(abandon.status).toBe(200);
    expect(abandon.json).toEqual({ session_id: aliceSession, status: "abandoned", abandoned: true });
    // Idempotent repeat.
    const abandonAgain = await alice.call("POST", `/api/v1/learning/sessions/${aliceSession}/abandon`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(abandonAgain.json.abandoned).toBe(true);

    const restart = await alice.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: FIXTURE_LESSON },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(restart.status).toBe(201);
    const secondSession = restart.json.session_id;

    // QA-08: expired session blocks answers; abandon is neutral.
    await (app as any).sql`
      update learning_sessions set expires_at = now() - interval '1 minute', created_at = now() - interval '2 minutes' where id = ${secondSession}
    `;
    const detail = await alice.call("GET", `/api/v1/learning/sessions/${secondSession}`);
    const question = detail.json.current_question;
    const answerExpired = await alice.call("POST", `/api/v1/learning/sessions/${secondSession}/answers`, {
      body: {
        event_id: crypto.randomUUID(),
        client_at: null,
        question_id: question.question_id,
        selected_option_id: "opt_lingkaran",
      },
    });
    expect(answerExpired.json.error.code).toBe("SESSION_EXPIRED");
    const abandonExpired = await alice.call("POST", `/api/v1/learning/sessions/${secondSession}/abandon`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(abandonExpired.status).toBe(200);
    expect(abandonExpired.json).toEqual({ session_id: secondSession, status: "expired", abandoned: false });

    // QA-08: recalled session blocks media; recalled version blocks starts.
    await (app as any).sql`
      update learning_sessions set status = 'recalled' where id = ${aliceSession}
    `;
    const streamRecalled = await alice.call("GET", `/api/v1/media/stream/${ASSET_STREAMING}?session_id=${aliceSession}`);
    expect(streamRecalled.status).toBe(410);
    expect(streamRecalled.json.error.code).toBe("CONTENT_RECALLED");

    await (app as any).sql`
      update lesson_versions set status = 'recalled' where id = ${FIXTURE_VERSION}
    `;
    const startRecalled = await alice.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: FIXTURE_LESSON },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(startRecalled.status).toBe(404);
  });

  it("refuses kids routes when the rollback flag is off", async () => {
    const noCookie = { call: async (_m: string, path: string) => {
      const res = await appOff.app.handle(new Request(`http://test.local${path}`, { method: _m }));
      const body = res.status >= 400 ? await res.json() : await res.json().catch(() => ({}));
      return { status: res.status, json: body, headers: Object.fromEntries(res.headers), raw: null };
    } };
    const abandoned = await noCookie.call("POST", "/api/v1/learning/sessions/00000000-0000-4000-8000-00000000d110/abandon");
    expect(abandoned.status).toBe(404);
    const stream = await noCookie.call(
      "GET",
      "/api/v1/media/stream/00000000-0000-4000-8000-00000000d1f1?session_id=00000000-0000-4000-8000-00000000d110",
    );
    expect(stream.status).toBe(404);
  });

  it("purges expired replay rows and deletion reaches child-scoped state (QA-20)", async () => {
    const dbUrl =
      (app as any).sql.options.connection.url ??
      "postgresql://rzq:local_only@127.0.0.1:5433/" + (app as any).sql.options.database;

    // Worker purge: expired rows go, live rows stay.
    await (app as any).sql`
      insert into idempotency_records (actor_scope, parent_id, method, route, idempotency_key, request_sha256, response_status, response_body, expires_at, created_at)
      values
        ('child:test', null, 'POST', '/purge-test', '11111111-1111-4111-8111-111111111111', repeat('a', 64), 200, '{}', now() - interval '1 hour', now() - interval '2 hours'),
        ('child:test', null, 'POST', '/purge-test', '22222222-2222-4222-8222-222222222222', repeat('b', 64), 200, '{}', now() + interval '1 hour', now())
    `;
    const db = createDatabase(dbUrl);
    const purged = await purgeExpiredIdempotency(db);
    expect(purged).toBeGreaterThanOrEqual(1);
    const left = await (app as any).sql`select count(*)::int as n from idempotency_records where actor_scope = 'child:test'`;
    expect(left[0].n).toBe(1);

    // Deletion: the child-scoped replay row from the journey is purged, and
    // the suppression ledger holds the profile.
    // Restore the fixture version that the release-state test recalled.
    await (app as any).sql`update lesson_versions set status = 'published' where id = ${FIXTURE_VERSION}`;
    const alice = await signUpVerifiedParent(app.app, app, app.baseUrl, "m1-alice-delete@example.com");
    const childId = await seed(alice, "m1-alice-delete@example.com");
    const delStart = await alice.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: FIXTURE_LESSON },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(delStart.status).toBe(201);
    const before = await (app as any).sql`select count(*)::int as n from idempotency_records where actor_scope = ${`child:${childId}`}`;
    expect(before[0].n).toBeGreaterThan(0);

    await alice.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    const del = await alice.call("DELETE", `/api/v1/parent/children/${childId}`, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(del.status).toBe(200);
    const after = await (app as any).sql`select count(*)::int as n from idempotency_records where actor_scope = ${`child:${childId}`}`;
    expect(after[0].n).toBe(0);
    const suppression = await (app as any).sql`select count(*)::int as n from deletion_suppressions where reference_key = ${childId}`;
    expect(suppression[0].n).toBe(1);
    void db;
    void schema;
  });
});
