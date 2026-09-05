// Guarded synthetic demo fixtures (T009).
//
// Seeds ONE clearly marked non-production Hijaiyah lesson plus the demo staff
// identities that authored/reviewed it. Runs only when APP_ENV is not
// production AND DEMO_MODE is enabled. Production startup must refuse these
// rows (see apps/api production readiness check).
//
// Honest-content rules honored here:
// - Arabic strings below are single Hijaiyah LETTERS (alphabet characters),
//   not Qur'an verses; no verse text, translation or recitation is fabricated.
// - No audio assets exist for the letters, so the UI must render its honest
//   "audio unavailable" state instead of a synthetic substitute.
import { eq } from "drizzle-orm";
import { createDatabase, schema } from "./index.ts";

const env = process.env.APP_ENV ?? "development";
const demoMode = process.env.DEMO_MODE === "true";
if (env === "production" || env === "staging") {
  console.error(`Refusing to seed demo fixtures in APP_ENV=${env}.`);
  process.exit(1);
}
if (!demoMode) {
  console.error("Refusing to seed demo fixtures: DEMO_MODE is not 'true'.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDatabase(databaseUrl);
const s = schema;

// Deterministic fixture UUIDs so reseeding is conflict-free.
const ID = {
  editorUser: "00000000-0000-4000-8000-00000000e001",
  reviewerUser: "00000000-0000-4000-8000-00000000e002",
  source: "00000000-0000-4000-8000-00000000d001",
  lesson: "00000000-0000-4000-8000-00000000d010",
  version: "00000000-0000-4000-8000-00000000d011",
  unitInstruction: "00000000-0000-4000-8000-00000000d0a1",
  unitLetterBa: "00000000-0000-4000-8000-00000000d0a2",
  unitLetterAlif: "00000000-0000-4000-8000-00000000d0a3",
  unitChoice: "00000000-0000-4000-8000-00000000d0a4",
  question: "00000000-0000-4000-8000-00000000d0b1",
} as const;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const canonicalPayload = {
  title: "Mengenal Huruf Ba dan Alif (Contoh Demo)",
  lesson_type: "listening",
  stage_key: "hijaiyah_dasar",
  units: [
    { ordinal: 1, unit_type: "instruction", required: false, instruction: "Hari ini kita berkenalan dengan dua huruf hijaiyah." },
    { ordinal: 2, unit_type: "letter", required: true, letter: "ب", instruction: "Dengarkan, lalu ikuti bacaannya: ba." },
    { ordinal: 3, unit_type: "letter", required: true, letter: "ا", instruction: "Dengarkan, lalu ikuti bacaannya: alif." },
    {
      ordinal: 4,
      unit_type: "choice",
      required: true,
      instruction: "Pilih huruf ba.",
      question: {
        prompt: "Mana yang merupakan huruf ba?",
        options: [
          { option_id: "ba", label: "ب" },
          { option_id: "alif", label: "ا" },
          { option_id: "jim", label: "ج" },
        ],
        correct_option_id: "ba",
      },
    },
  ],
};
const releaseHash = await sha256Hex(JSON.stringify(canonicalPayload));

console.log("Seeding demo fixtures (clearly marked non-production) …");

await db.transaction(async (tx) => {
  // Demo staff identities. They never log in; no credentials are provisioned.
  await tx
    .insert(s.user)
    .values([
      { id: ID.editorUser, name: "Demo Editor", email: "demo-editor@rzq.invalid", emailVerified: true },
      { id: ID.reviewerUser, name: "Demo Reviewer", email: "demo-reviewer@rzq.invalid", emailVerified: true },
    ])
    .onConflictDoNothing();

  await tx
    .insert(s.staffMembers)
    .values([
      { authUserId: ID.editorUser, capabilities: ["content_editor"], active: true },
      { authUserId: ID.reviewerUser, capabilities: ["content_reviewer", "content_publisher"], active: true },
    ])
    .onConflictDoNothing();

  await tx
    .insert(s.contentSources)
    .values({
      id: ID.source,
      sourceKind: "hijaiyah_audio",
      title: "Sumber contoh internal — BUKAN produksi",
      sourceVersion: "demo-1",
      upstreamReference: "demo-fixture://internal/hijaiyah",
      acquiredAt: new Date("2026-09-05T00:00:00Z"),
      demoOnly: true,
      rightsStatus: "approved", // demo-simulated approval for local fixture only
      permittedUses: ["display"],
      licenseReference: "DEMO-NON-PRODUCTION",
      attribution: "Fixture internal untuk pengembangan; bukan materi produksi.",
      evidenceObjectKey: "demo://evidence/nonproduction",
      rawObjectKey: "demo://raw/nonproduction",
      rawSha256: await sha256Hex("demo-source-nonproduction"),
      registeredBy: ID.editorUser,
      reviewedBy: ID.reviewerUser,
    })
    .onConflictDoNothing();

  await tx.insert(s.lessons).values({ id: ID.lesson, stableKey: "demo_hijaiyah_letters_1" }).onConflictDoNothing();

  await tx
    .insert(s.lessonVersions)
    .values({
      id: ID.version,
      lessonId: ID.lesson,
      versionNumber: 1,
      title: "Mengenal Huruf Ba dan Alif (Contoh Demo)",
      lessonType: "listening",
      stageKey: "hijaiyah_dasar",
      estimatedMinutes: 2,
      demoOnly: true,
      sourceIds: [ID.source],
      status: "published",
      releaseHash,
      authorId: ID.editorUser,
      reviewerId: ID.reviewerUser,
      publishedAt: new Date(),
    })
    .onConflictDoNothing();

  await tx
    .insert(s.lessonUnits)
    .values([
      {
        id: ID.unitInstruction,
        versionId: ID.version,
        ordinal: 1,
        unitType: "instruction",
        required: false,
        instruction: canonicalPayload.units[0].instruction,
      },
      {
        id: ID.unitLetterBa,
        versionId: ID.version,
        ordinal: 2,
        unitType: "letter",
        required: true,
        instruction: canonicalPayload.units[1].instruction,
        letter: "ب",
        // audioAssetId intentionally null: honest missing-audio demo state.
      },
      {
        id: ID.unitLetterAlif,
        versionId: ID.version,
        ordinal: 3,
        unitType: "letter",
        required: true,
        instruction: canonicalPayload.units[2].instruction,
        letter: "ا",
      },
      {
        id: ID.unitChoice,
        versionId: ID.version,
        ordinal: 4,
        unitType: "choice",
        required: true,
        instruction: canonicalPayload.units[3].instruction,
      },
    ])
    .onConflictDoNothing();

  await tx
    .insert(s.questions)
    .values({
      id: ID.question,
      unitId: ID.unitChoice,
      versionId: ID.version,
      prompt: canonicalPayload.units[3].question!.prompt,
      options: canonicalPayload.units[3].question!.options,
      correctOptionId: canonicalPayload.units[3].question!.correct_option_id,
      explanation: "Huruf ba berbentuk ب, dengan satu titik di bawah.",
    })
    .onConflictDoNothing();

  await tx.update(s.lessons).set({ currentVersionId: ID.version }).where(eq(s.lessons.id, ID.lesson));
});

console.log("Demo fixtures seeded:");
console.log("  staff: demo-editor / demo-reviewer (no credentials)");
console.log(`  lesson: ${ID.lesson} (stable_key=demo_hijaiyah_letters_1, demo_only=true, published)`);
console.log("  note: letters only, no audio assets (honest unavailable state)");
process.exit(0);
