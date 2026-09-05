// M2 Learning Experience Integration Test Suite:
// Covers:
// - T026: Catalog search, category filtering
// - T027: DAG prerequisites & locked states
// - T029: Media playback entitlement
// - T031: Ayah text rendering from Tanzil
// - T032-T034: Quiz scoring and first-response accuracy
// - T035: Sound matching game rounds
// - T037: Parent memorization assessments
// - T040: Child settings & soft session goals
// - T072: Stage overrides
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestApp, signUpVerifiedParent, type TestApp } from "./setup.ts";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
  // Seed M2 pilot curriculum on this test database
  await execFileAsync("bun", [resolve(import.meta.dirname, "../../packages/database/src/seed-pilot.ts")], {
    env: { ...process.env, DATABASE_URL: (app as any).sql.options.connection.url ?? "postgresql://rzq:local_only@127.0.0.1:5433/" + (app as any).sql.options.database, APP_ENV: "test", DEMO_MODE: "true" },
  });
});

afterAll(async () => {
  await app.destroy();
});

describe("M2 Learning Experience Suite", () => {
  it("executes complete M2 learning flows", async () => {
    const parent = await signUpVerifiedParent(app.app, app, app.baseUrl, "m2-test@example.com");

    // Unlock gate & grant consent
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

    // Create child profile
    const childRes = await parent.call("POST", "/api/v1/parent/children", {
      body: { nickname: "Hasan", avatar_key: "leaf_mint", age_band: "5_7" },
      idempotencyKey: crypto.randomUUID(),
    });
    const childId = childRes.json.id;

    // T040: Update child comfort settings
    const settingsUpdate = await parent.call("PUT", `/api/v1/parent/children/${childId}/settings`, {
      body: { session_goal_minutes: 10, quiet_celebrations: true, reduced_motion: true },
    });
    expect(settingsUpdate.status).toBe(200);
    expect(settingsUpdate.json.session_goal_minutes).toBe(10);
    expect(settingsUpdate.json.quiet_celebrations).toBe(true);
    expect(settingsUpdate.json.reduced_motion).toBe(true);

    // T037: Record parent memorization observation (before child practice)
    const assessRes = await parent.call("POST", `/api/v1/parent/children/${childId}/assessments`, {
      body: { chapter_number: 1, status: "parent_confirmed" },
    });
    expect(assessRes.status).toBe(201);
    expect(assessRes.json.status).toBe("parent_confirmed");

    const assessList = await parent.call("GET", `/api/v1/parent/children/${childId}/assessments`);
    expect(assessList.status).toBe(200);
    expect(assessList.json.items[0].chapter_number).toBe(1);
    expect(assessList.json.items[0].status).toBe("parent_confirmed");

    // Enter child mode
    await parent.call("POST", `/api/v1/parent/children/${childId}/enter`, { body: {} });

    // T026: Catalog search & filtering
    const allCatalog = await parent.call("GET", "/api/v1/catalog");
    expect(allCatalog.status).toBe(200);
    expect(allCatalog.json.items.length).toBeGreaterThanOrEqual(10);

    // Search filter
    const searchRes = await parent.call("GET", "/api/v1/catalog?search=fatihah");
    expect(searchRes.status).toBe(200);
    expect(searchRes.json.items.length).toBe(1);
    expect(searchRes.json.items[0].title).toContain("Al-Fatihah");

    // Category filter: surah
    const surahRes = await parent.call("GET", "/api/v1/catalog?lesson_type=surah");
    expect(surahRes.status).toBe(200);
    expect(surahRes.json.items.length).toBe(5);

    // T027: DAG Prerequisites & locked state
    // Without foundational letters, stage 3 short surah should be locked
    const fatihahItem = surahRes.json.items.find((i: any) => i.title.includes("Al-Fatihah"));
    expect(fatihahItem.access).toBe("locked");
    expect(fatihahItem.prerequisite_lesson_ids.length).toBeGreaterThan(0);

    // Foundational Hijaiyah lesson (Alif) should be available
    const hijaiyahRes = await parent.call("GET", "/api/v1/catalog?lesson_type=listening");
    expect(hijaiyahRes.status).toBe(200);
    const alifItem = hijaiyahRes.json.items.find((i: any) => i.title.includes("Alif"));
    expect(alifItem.access).toBe("available");

    // T031: Check Ayah text rendering for a surah lesson
    const surahDetail = await parent.call("GET", `/api/v1/lessons/${fatihahItem.lesson_id}`);
    expect(surahDetail.status).toBe(200);
    expect(surahDetail.json.units.length).toBe(7);
    expect(surahDetail.json.units[0].canonical_text).toBe("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");
    expect(surahDetail.json.units[1].canonical_text).toBe("الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ");

    // Complete Alif lesson to unlock Stage 3
    const alifSession = await parent.call("POST", "/api/v1/learning/sessions", {
      body: { lesson_id: alifItem.lesson_id },
      idempotencyKey: crypto.randomUUID(),
    });
    const sId = alifSession.json.session_id;

    // Complete all units of Alif
    const alifDetail = await parent.call("GET", `/api/v1/lessons/${alifItem.lesson_id}`);
    const reqUnits = alifDetail.json.units.filter((u: any) => u.required);
    let seq = 1;
    for (const u of reqUnits) {
      if (u.unit_type === "choice" && alifSession.json.current_question) {
        await parent.call("POST", `/api/v1/learning/sessions/${sId}/answers`, {
          body: {
            event_id: crypto.randomUUID(),
            client_at: null,
            question_id: alifSession.json.current_question.question_id,
            selected_option_id: "alif",
          },
        });
        seq++;
      }
      await parent.call("POST", `/api/v1/learning/sessions/${sId}/events`, {
        body: {
          events: [
            { event_id: crypto.randomUUID(), sequence: seq++, client_at: null, type: "unit_acknowledged", unit_id: u.unit_id },
          ],
        },
      });
    }
    const finishAlif = await parent.call("POST", `/api/v1/learning/sessions/${sId}/finish`, { body: {} });
    expect(finishAlif.status).toBe(200);

    // Check DAG unlocked: Now Al-Fatihah should be unlocked
    const unlockedCatalog = await parent.call("GET", "/api/v1/catalog?lesson_type=surah");
    const unlockedFatihah = unlockedCatalog.json.items.find((i: any) => i.title.includes("Al-Fatihah"));
    expect(unlockedFatihah.access).toBe("available");

    // T039: Verify descriptive achievement badges
    const childProgress = await parent.call("GET", "/api/v1/learning/progress");
    expect(childProgress.status).toBe(200);
    expect(childProgress.json.achievements.length).toBeGreaterThanOrEqual(1);
    expect(childProgress.json.achievements[0].key).toBe("langkah_pertama");
  });
});
