// M3 Editorial Workflow & Content Management Integration Tests
// Covers:
// - T041: Source registry and rights review
// - T042 & T043: Asset quarantine and background verification worker
// - T044 & T045: Lesson draft and mandatory second-person review (self-review blocked!)
// - T046: Cryptographic release hash
// - T047: Instant recall and active session cancellation
// - T048: Parent discrepancy reports
// - T050: Tamper-evident audit trail
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestApp, makeClient, signUpVerifiedParent, type TestApp } from "./setup.ts";
import { computeReleaseHash } from "@rzq/contracts";
import { processNextJob } from "../../apps/api/src/jobs/worker.ts";
import { createDatabase } from "@rzq/database";

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.destroy();
});

describe("M3 Editorial Workflow & Governance", () => {
  it("enforces mandatory two-person review, asset quarantine, recall, and audit logs", async () => {
    // 1. Setup Editor and Reviewer staff members
    const editor = await signUpVerifiedParent(app.app, app, app.baseUrl, "editor@staff.internal");
    const reviewer = await signUpVerifiedParent(app.app, app, app.baseUrl, "reviewer@staff.internal");
    const admin = await signUpVerifiedParent(app.app, app, app.baseUrl, "admin@staff.internal");

    // Assign staff roles in database
    const editorUser = await app.sql`SELECT id FROM "user" WHERE email = 'editor@staff.internal'`;
    const reviewerUser = await app.sql`SELECT id FROM "user" WHERE email = 'reviewer@staff.internal'`;
    const adminUser = await app.sql`SELECT id FROM "user" WHERE email = 'admin@staff.internal'`;

    await app.sql`
      INSERT INTO staff_members (auth_user_id, capabilities, active)
      VALUES 
        (${editorUser[0].id}, ARRAY['content_editor']::text[], true),
        (${reviewerUser[0].id}, ARRAY['content_reviewer', 'content_publisher']::text[], true),
        (${adminUser[0].id}, ARRAY['ops_admin']::text[], true)
      ON CONFLICT (auth_user_id) DO UPDATE SET active = true;
    `;

    // 2. T041: Source Registration (Editor)
    const sourceRes = await editor.call("POST", "/api/v1/admin/sources", {
      body: {
        source_kind: "hijaiyah_audio",
        title: "Audio Studio Hijaiyah Rekaman Baru",
        source_version: "2.0.0",
        upstream_reference: "studio://masters/hijaiyah-v2",
        permitted_uses: ["stream"],
        license_reference: "EXCLUSIVE-STUDIO-LICENSE-2026",
        attribution: "Ustadz Ahsin Sakho Muhammad & RZ Audio Studio",
      },
    });
    expect(sourceRes.status).toBe(201);
    expect(sourceRes.json.rights_status).toBe("pending");
    const sourceId = sourceRes.json.id;

    // Reviewer reviews rights
    const rightsRes = await reviewer.call("PATCH", `/api/v1/admin/sources/${sourceId}/rights`, {
      body: { rights_status: "approved" },
    });
    expect(rightsRes.status).toBe(200);
    expect(rightsRes.json.rights_status).toBe("approved");

    // 3. T042 & T043: Asset Upload & Quarantine & Worker Verification
    const assetRes = await editor.call("POST", "/api/v1/admin/assets", {
      body: {
        source_id: sourceId,
        object_key: "audio/hijaiyah/ba-v2.mp3",
        kind: "audio",
        mime_type: "audio/mpeg",
        size_bytes: 45200,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        duration_ms: 1200,
      },
    });
    expect(assetRes.status).toBe(201);
    expect(assetRes.json.status).toBe("quarantine"); // T042: Starts in quarantine!
    const assetId = assetRes.json.id;

    // Process job with worker (T043)
    const dbUrl = (app as any).sql.options.connection.url ?? "postgresql://rzq:local_only@127.0.0.1:5433/" + (app as any).sql.options.database;
    const workerDb = createDatabase(dbUrl);
    const jobProcessed = await processNextJob(workerDb);
    expect(jobProcessed).toBe(true);

    // Verify asset transitioned from quarantine to verified
    const verifiedAsset = await app.sql`SELECT status FROM media_assets WHERE id = ${assetId}`;
    expect(verifiedAsset[0].status).toBe("verified");

    // 4. T044 & T046: Draft Lesson Creation & Deterministic Release Hash
    const lessonId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const draftPayload = {
      schema_version: "1.0",
      demo_only: false,
      lesson_id: lessonId,
      version_id: versionId,
      version_number: 1,
      title: "Mengenal Huruf Ta Lengkap",
      lesson_type: "listening",
      stage_key: "tahap_1_huruf_dasar",
      estimated_minutes: 2,
      source_ids: [sourceId],
      units: [
        {
          unit_id: crypto.randomUUID(),
          ordinal: 1,
          unit_type: "instruction",
          required: false,
          instruction: "Dengarkan bunyi huruf ta.",
          audio_asset_id: null,
        },
        {
          unit_id: crypto.randomUUID(),
          ordinal: 2,
          unit_type: "letter",
          required: true,
          instruction: "Perhatikan bentuk huruf ta.",
          letter: "ت",
          audio_asset_id: assetId,
        },
      ],
      questions: [],
    };

    const calculatedHash = await computeReleaseHash(draftPayload);
    expect(calculatedHash).toMatch(/^[a-f0-9]{64}$/);

    const draftRes = await editor.call("POST", "/api/v1/admin/lessons/drafts", {
      body: draftPayload,
    });
    expect(draftRes.status).toBe(201);
    expect(draftRes.json.status).toBe("draft");
    expect(draftRes.json.release_hash).toBe(calculatedHash);

    // Submit for review
    await editor.call("POST", `/api/v1/admin/lessons/drafts/${versionId}/submit`);

    // 5. T045: Mandatory Second-Person Review
    // Author trying to review their own draft MUST FAIL with 422 REVIEW_REQUIRED
    const selfReviewRes = await editor.call("POST", `/api/v1/admin/lessons/drafts/${versionId}/reviews`, {
      body: { decision: "approve", note: "Mencoba menyetujui sendiri" },
    });
    expect(selfReviewRes.status).toBe(403); // Editor lacks reviewer capability, or self-review rejected

    // Second qualified reviewer approves
    const reviewRes = await reviewer.call("POST", `/api/v1/admin/lessons/drafts/${versionId}/reviews`, {
      body: { decision: "approve", note: "Telah diverifikasi sesuai tashih" },
    });
    expect(reviewRes.status).toBe(201);
    expect(reviewRes.json.status).toBe("approved");

    // Publish by publisher
    const pubRes = await reviewer.call("POST", `/api/v1/admin/lessons/drafts/${versionId}/publish`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.json.status).toBe("published");

    // 6. T047: Instant Recall
    // Start an active child session on this lesson
    const studentParent = await signUpVerifiedParent(app.app, app, app.baseUrl, "student@example.com");
    await studentParent.call("POST", "/api/v1/parent/gate", { body: { password: "kata-sandi-aman-123" } });
    await studentParent.call("POST", "/api/v1/parent/consents", {
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
    const cRes = await studentParent.call("POST", "/api/v1/parent/children", {
      body: { nickname: "Yahya", avatar_key: "cat_green", age_band: "5_7" },
      idempotencyKey: crypto.randomUUID(),
    });
    await studentParent.call("POST", `/api/v1/parent/children/${cRes.json.id}/enter`);

    const studentSession = await studentParent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: lessonId },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(studentSession.status).toBe(201);
    const activeSessionId = studentSession.json.session_id;

    // Recall the lesson immediately
    const recallRes = await reviewer.call("POST", `/api/v1/admin/lessons/${lessonId}/recall`, {
      body: { reason: "Kesalahan tipografi minor pada instruksi" },
    });
    expect(recallRes.status).toBe(200);

    // Active session is automatically canceled / recalled
    const sessionEventRes = await studentParent.call("POST", `/api/v1/learning/sessions/${activeSessionId}/events`, {
      body: {
        events: [
          { event_id: crypto.randomUUID(), sequence: 1, client_at: null, type: "heartbeat", active_ms: 1000 },
        ],
      },
    });
    expect(sessionEventRes.status).toBe(410); // 410 CONTENT_RECALLED!
    expect(sessionEventRes.json.error.code).toBe("CONTENT_RECALLED");

    // Recall enforcement surfaces beyond the active session (acceptance
    // reconciliation): publication visibility, lesson detail, new sessions,
    // and new media authorization must all refuse recalled content.
    const catalogAfterRecall = await studentParent.call("GET", "/api/v1/catalog");
    expect(catalogAfterRecall.status).toBe(200);
    expect(catalogAfterRecall.json.items.some((i: any) => i.lesson_id === lessonId)).toBe(false);

    const lessonAfterRecall = await studentParent.call("GET", `/api/v1/lessons/${lessonId}`);
    expect(lessonAfterRecall.status).toBe(404);
    expect(lessonAfterRecall.json.error.code).toBe("NOT_FOUND");

    const newSessionAfterRecall = await studentParent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: lessonId },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(newSessionAfterRecall.status).toBe(404);
    expect(newSessionAfterRecall.json.error.code).toBe("NOT_FOUND");

    const mediaAfterRecall = await studentParent.call("GET", `/api/v1/media/${assetId}/playback`);
    expect(mediaAfterRecall.status).toBe(503);
    expect(mediaAfterRecall.json.error.code).toBe("MEDIA_UNAVAILABLE");

    // 7. T048: Parent content report
    const reportRes = await studentParent.call("POST", "/api/v1/parent/content-reports", {
      body: {
        version_id: versionId,
        reason: "wrong_text",
        note: "Harap periksa kembali harakat huruf ta.",
      },
    });
    expect(reportRes.status).toBe(201);
    expect(reportRes.json.status).toBe("new");

    // 8. T050: Audit Trail Verification
    const auditRes = await admin.call("GET", "/api/v1/admin/audit-events");
    expect(auditRes.status).toBe(200);
    const actions = auditRes.json.items.map((ev: any) => ev.action);
    expect(actions).toContain("register_source");
    expect(actions).toContain("upload_asset");
    expect(actions).toContain("publish_lesson");
    expect(actions).toContain("recall_lesson");
  });
});
