// Kids-MVP engineering fixture (GDM-005): ONE clearly marked shapes-and-tones
// lesson proving the three-example / three-round client flow. Runs only when
// APP_ENV is not production/staging AND DEMO_MODE is enabled.
//
// Honest-content rules honored here:
// - Items are abstract shapes (lingkaran/persegi/segitiga) with Indonesian
//   labels. No Arabic letters, no verse text, no generated recitation, no
//   audio assets: the client renders its honest unavailable-audio state.
// - demo_only=true is the server-controlled fixture marker; the API layer
//   derives content_mode from it and clients must show a fixture badge.
// - Exactly 3 public item units + exactly 3 deterministic question rounds,
//   per docs/godot-mvp/contracts/content.md (bundle v1.0).
import { eq } from "drizzle-orm";
import { createDatabase, schema } from "./index.ts";

const env = process.env.APP_ENV ?? "development";
const demoMode = process.env.DEMO_MODE === "true";
if (env === "production" || env === "staging") {
  console.error(`Refusing to seed MVP fixture in APP_ENV=${env}.`);
  process.exit(1);
}
if (!demoMode) {
  console.error("Refusing to seed MVP fixture: DEMO_MODE is not 'true'.");
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
  source: "00000000-0000-4000-8000-00000000d101",
  lesson: "00000000-0000-4000-8000-00000000d110",
  version: "00000000-0000-4000-8000-00000000d111",
  unitItemLingkaran: "00000000-0000-4000-8000-00000000d1a1",
  unitItemPersegi: "00000000-0000-4000-8000-00000000d1a2",
  unitItemSegitiga: "00000000-0000-4000-8000-00000000d1a3",
  unitRound1: "00000000-0000-4000-8000-00000000d1b1",
  unitRound2: "00000000-0000-4000-8000-00000000d1b2",
  unitRound3: "00000000-0000-4000-8000-00000000d1b3",
  question1: "00000000-0000-4000-8000-00000000d1c1",
  question2: "00000000-0000-4000-8000-00000000d1c2",
  question3: "00000000-0000-4000-8000-00000000d1c3",
} as const;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Round = {
  prompt: string;
  options: { option_id: string; label: string }[];
  correct_option_id: string;
};

const ITEMS = [
  { key: "lingkaran", glyph: "●", instruction: "Ini lingkaran. Perhatikan bentuknya, ya!" },
  { key: "persegi", glyph: "■", instruction: "Ini persegi. Perhatikan bentuknya, ya!" },
  { key: "segitiga", glyph: "▲", instruction: "Ini segitiga. Perhatikan bentuknya, ya!" },
] as const;

const OPTIONS = [
  { option_id: "opt_lingkaran", label: "Lingkaran" },
  { option_id: "opt_persegi", label: "Persegi" },
  { option_id: "opt_segitiga", label: "Segitiga" },
] as const;

// Deterministic rounds: round N asks for item N.
const ROUNDS: Round[] = ITEMS.map((item, index) => ({
  prompt: `Bentuk mana yang tadi bernama ${item.key}?`,
  options: [...OPTIONS],
  correct_option_id: OPTIONS[index].option_id,
}));

const canonicalPayload = {
  title: "Latihan Simulasi: Bentuk dan Warna (Fixture)",
  lesson_type: "quiz",
  stage_key: "fixture_engineering",
  items: ITEMS.map((item) => ({ ordinal_key: item.key, glyph: item.glyph })),
  rounds: ROUNDS.map((round) => ({ prompt: round.prompt, correct_option_id: round.correct_option_id })),
};
const releaseHash = await sha256Hex(JSON.stringify(canonicalPayload));

console.log("Seeding kids-MVP engineering fixture (clearly marked non-learning) …");

await db.transaction(async (tx) => {
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
      sourceKind: "engineering_fixture",
      title: "Fixture engineering internal — BUKAN materi belajar",
      sourceVersion: "mvp-fixture-1",
      upstreamReference: "fixture://internal/shapes-and-tones",
      acquiredAt: new Date("2026-09-08T00:00:00Z"),
      demoOnly: true,
      rightsStatus: "approved", // demo-simulated approval for local fixture only
      permittedUses: ["display"],
      licenseReference: "DEMO-NON-PRODUCTION",
      attribution: "Fixture internal untuk pengembangan; bukan materi produksi.",
      evidenceObjectKey: "demo://evidence/nonproduction",
      rawObjectKey: "demo://raw/nonproduction",
      rawSha256: await sha256Hex("mvp-fixture-shapes-and-tones"),
      registeredBy: ID.editorUser,
      reviewedBy: ID.reviewerUser,
    })
    .onConflictDoNothing();

  await tx.insert(s.lessons).values({ id: ID.lesson, stableKey: "fixture_shapes_tones_3" }).onConflictDoNothing();

  await tx
    .insert(s.lessonVersions)
    .values({
      id: ID.version,
      lessonId: ID.lesson,
      versionNumber: 1,
      title: canonicalPayload.title,
      lessonType: canonicalPayload.lesson_type as "quiz",
      stageKey: canonicalPayload.stage_key,
      estimatedMinutes: 3,
      demoOnly: true,
      sourceIds: [ID.source],
      status: "published",
      releaseHash,
      authorId: ID.editorUser,
      reviewerId: ID.reviewerUser,
      publishedAt: new Date(),
    })
    .onConflictDoNothing();

  // Exactly three public item units (required: viewing counts toward honest
  // completion) followed by exactly three required round units.
  await tx
    .insert(s.lessonUnits)
    .values([
      ...ITEMS.map((item, index) => ({
        id: ID[`unitItem${index === 0 ? "Lingkaran" : index === 1 ? "Persegi" : "Segitiga"}` as const],
        versionId: ID.version,
        ordinal: index + 1,
        unitType: "letter" as const, // presentation item; carries the shape glyph
        required: true,
        instruction: item.instruction,
        letter: item.glyph,
        // audioAssetId intentionally null: display-only fixture, honest state.
      })),
      ...ROUNDS.map((round, index) => ({
        id: ID[`unitRound${index + 1}` as const],
        versionId: ID.version,
        ordinal: ITEMS.length + index + 1,
        unitType: "choice" as const,
        required: true,
        instruction: round.prompt,
      })),
    ])
    .onConflictDoNothing();

  await tx.insert(s.questions).values(
    ROUNDS.map((round, index) => ({
      id: ID[`question${index + 1}` as const],
      unitId: ID[`unitRound${index + 1}` as const],
      versionId: ID.version,
      prompt: round.prompt,
      options: [...round.options],
      correctOptionId: round.correct_option_id,
      explanation: "Fixture rekayasa — bukan penilaian belajar.",
    })),
  ).onConflictDoNothing();

  await tx.update(s.lessons).set({ currentVersionId: ID.version }).where(eq(s.lessons.id, ID.lesson));
});

console.log("Kids-MVP fixture seeded:");
console.log(`  lesson: ${ID.lesson} (stable_key=fixture_shapes_tones_3, demo_only=true, published)`);
console.log("  3 items (display-only shapes) + 3 deterministic rounds; no audio, no Arabic, no recitation");
process.exit(0);
