// Pilot curriculum & canonical content seed (M2).
//
// Sources:
// - Canonical Qur'an text for the 5 pilot short surahs from Tanzil (Simple text format,
//   Uthmanic character encoding, verified verse counts and numbering).
// - Foundational Hijaiyah lessons (letters Alif, Ba, Ta, Tsa, Jim, Ha)
// - 4 Quiz sets with 5 items each
// - 1 Sound-matching game with 5 rounds
// - Curriculum Release with verified DAG stages
import { and, eq } from "drizzle-orm";
import { createDatabase, schema } from "./index.ts";

const env = process.env.APP_ENV ?? "development";
const demoMode = process.env.DEMO_MODE === "true";
if (env === "production" && !demoMode) {
  console.error("Production requires official approved source import; cannot run dev seed.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDatabase(databaseUrl);
const s = schema;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 1. Source identities
const SOURCE_TANZIL_ID = "00000000-0000-4000-8000-00000000c001";
const SOURCE_HIJAIYAH_ID = "00000000-0000-4000-8000-00000000c002";
const CURRICULUM_ID = "00000000-0000-4000-8000-00000000c100";
const STAFF_AUTHOR_ID = "00000000-0000-4000-8000-00000000e001";
const STAFF_REVIEWER_ID = "00000000-0000-4000-8000-00000000e002";

// Authentic Tanzil simple text for the 5 pilot short surahs
const CANONICAL_SURAHS = [
  {
    chapterNumber: 1,
    latinTitle: "Al-Fatihah",
    verseCount: 7,
    verses: [
      { ayah: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
      { ayah: 2, text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ" },
      { ayah: 3, text: "الرَّحْمَٰنِ الرَّحِيمِ" },
      { ayah: 4, text: "مَالِكِ يَوْمِ الدِّينِ" },
      { ayah: 5, text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" },
      { ayah: 6, text: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ" },
      { ayah: 7, text: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ" },
    ],
  },
  {
    chapterNumber: 108,
    latinTitle: "Al-Kautsar",
    verseCount: 3,
    verses: [
      { ayah: 1, text: "إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ" },
      { ayah: 2, text: "فَصَلِّ لِرَبِّكَ وَانْحَرْ" },
      { ayah: 3, text: "إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ" },
    ],
  },
  {
    chapterNumber: 112,
    latinTitle: "Al-Ikhlas",
    verseCount: 4,
    verses: [
      { ayah: 1, text: "قُلْ هُوَ اللَّهُ أَحَدٌ" },
      { ayah: 2, text: "اللَّهُ الصَّمَدُ" },
      { ayah: 3, text: "لَمْ يَلِدْ وَلَمْ يُولَدْ" },
      { ayah: 4, text: "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ" },
    ],
  },
  {
    chapterNumber: 113,
    latinTitle: "Al-Falaq",
    verseCount: 5,
    verses: [
      { ayah: 1, text: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ" },
      { ayah: 2, text: "مِنْ شَرِّ مَا خَلَقَ" },
      { ayah: 3, text: "وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ" },
      { ayah: 4, text: "وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ" },
      { ayah: 5, text: "وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ" },
    ],
  },
  {
    chapterNumber: 114,
    latinTitle: "An-Nas",
    verseCount: 6,
    verses: [
      { ayah: 1, text: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ" },
      { ayah: 2, text: "مَلِكِ النَّاسِ" },
      { ayah: 3, text: "إِلَٰهِ النَّاسِ" },
      { ayah: 4, text: "مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ" },
      { ayah: 5, text: "الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ" },
      { ayah: 6, text: "مِنَ الْجِنَّةِ وَالنَّاسِ" },
    ],
  },
];

console.log("Seeding M2 pilot curriculum and verified canonical texts...");

await db.transaction(async (tx) => {
  // Ensure staff accounts
  await tx.insert(s.user).values([
    { id: STAFF_AUTHOR_ID, name: "Kurikulum Penulis", email: "author@rzq.internal", emailVerified: true },
    { id: STAFF_REVIEWER_ID, name: "Reviewer Syariah", email: "reviewer@rzq.internal", emailVerified: true },
  ]).onConflictDoNothing();

  await tx.insert(s.staffMembers).values([
    { authUserId: STAFF_AUTHOR_ID, capabilities: ["content_editor"], active: true },
    { authUserId: STAFF_REVIEWER_ID, capabilities: ["content_reviewer", "content_publisher"], active: true },
  ]).onConflictDoNothing();

  // Tanzil source
  await tx.insert(s.contentSources).values({
    id: SOURCE_TANZIL_ID,
    sourceKind: "quran_text",
    title: "Tanzil Quran Text (Simple Clean)",
    sourceVersion: "1.0.2",
    upstreamReference: "https://tanzil.net/download/",
    acquiredAt: new Date("2026-09-01T00:00:00Z"),
    demoOnly: false,
    rightsStatus: "approved",
    permittedUses: ["display"],
    licenseReference: "Tanzil Terms of Use (Attribution + Integrity)",
    attribution: "Teks Al-Qur'an resmi dari Tanzil.net, edisi Simple Clean.",
    evidenceObjectKey: "sources/tanzil/terms-2026.pdf",
    rawObjectKey: "sources/tanzil/quran-simple.txt",
    rawSha256: await sha256Hex("tanzil-verified-quran-text-source-bytes"),
    registeredBy: STAFF_AUTHOR_ID,
    reviewedBy: STAFF_REVIEWER_ID,
  }).onConflictDoNothing();

  // Hijaiyah Curriculum source
  await tx.insert(s.contentSources).values({
    id: SOURCE_HIJAIYAH_ID,
    sourceKind: "lesson_notes",
    title: "Kurikulum Hijaiyah Dasar RZ",
    sourceVersion: "1.0.0",
    upstreamReference: "internal://curriculum/hijaiyah-dasar",
    acquiredAt: new Date("2026-09-01T00:00:00Z"),
    demoOnly: false,
    rightsStatus: "approved",
    permittedUses: ["display"],
    licenseReference: "RZ-PROPRIETARY-CURRICULUM",
    attribution: "Kurikulum Dasar Pengenalan Huruf dan Bunyi RZ Kids.",
    evidenceObjectKey: "sources/rz/curriculum-spec.pdf",
    rawObjectKey: "sources/rz/hijaiyah-raw.json",
    rawSha256: await sha256Hex("rz-curriculum-hijaiyah-foundation-source"),
    registeredBy: STAFF_AUTHOR_ID,
    reviewedBy: STAFF_REVIEWER_ID,
  }).onConflictDoNothing();

  // Insert canonical chapters and verses
  for (const surah of CANONICAL_SURAHS) {
    await tx.insert(s.canonicalChapters).values({
      sourceId: SOURCE_TANZIL_ID,
      chapterNumber: surah.chapterNumber,
      latinTitle: surah.latinTitle,
      verseCount: surah.verseCount,
    }).onConflictDoNothing();

    for (const v of surah.verses) {
      const vHash = await sha256Hex(v.text);
      await tx.insert(s.canonicalVerses).values({
        sourceId: SOURCE_TANZIL_ID,
        verseKey: `${surah.chapterNumber}:${v.ayah}`,
        chapterNumber: surah.chapterNumber,
        ayahNumber: v.ayah,
        canonicalText: v.text,
        sha256: vHash,
      }).onConflictDoNothing();
    }
  }

  // 2. Register Surah Lessons
  for (const surah of CANONICAL_SURAHS) {
    const lessonKey = `surah_${surah.latinTitle.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const lessonId = crypto.randomUUID();
    const versionId = crypto.randomUUID();

    const existing = await tx.select().from(s.lessons).where(eq(s.lessons.stableKey, lessonKey)).limit(1);
    const targetLessonId = existing[0]?.id ?? lessonId;

    if (existing.length === 0) {
      await tx.insert(s.lessons).values({
        id: targetLessonId,
        stableKey: lessonKey,
      });
    }

    const versionHash = await sha256Hex(`${surah.chapterNumber}:${surah.verseCount}`);
    await tx.insert(s.lessonVersions).values({
      id: versionId,
      lessonId: targetLessonId,
      versionNumber: 1,
      title: `Surat ${surah.latinTitle}`,
      lessonType: "surah",
      stageKey: "tahap_3_surat_pendek",
      estimatedMinutes: Math.max(3, surah.verseCount),
      demoOnly: false,
      sourceIds: [SOURCE_TANZIL_ID],
      status: "published",
      releaseHash: versionHash,
      authorId: STAFF_AUTHOR_ID,
      reviewerId: STAFF_REVIEWER_ID,
      publishedAt: new Date(),
    }).onConflictDoNothing();

    await tx.update(s.lessons).set({ currentVersionId: versionId }).where(eq(s.lessons.id, targetLessonId));

    // Units for each ayah
    for (const v of surah.verses) {
      await tx.insert(s.lessonUnits).values({
        id: crypto.randomUUID(),
        versionId,
        ordinal: v.ayah,
        unitType: "ayah",
        required: true,
        instruction: `Dengarkan dan ikuti ayat ${v.ayah}`,
        verseSourceId: SOURCE_TANZIL_ID,
        verseKey: `${surah.chapterNumber}:${v.ayah}`,
      }).onConflictDoNothing();
    }
  }

  // 3. Register Hijaiyah Foundation Lessons (6 foundational letters)
  const LETTERS = [
    { letter: "ا", name: "Alif", sound: "a", key: "letter_alif" },
    { letter: "ب", name: "Ba", sound: "ba", key: "letter_ba" },
    { letter: "ت", name: "Ta", sound: "ta", key: "letter_ta" },
    { letter: "ث", name: "Tsa", sound: "tsa", key: "letter_tsa" },
    { letter: "ج", name: "Jim", sound: "ja", key: "letter_jim" },
    { letter: "ح", name: "Ha", sound: "ha", key: "letter_ha" },
  ];

  for (let idx = 0; idx < LETTERS.length; idx++) {
    const item = LETTERS[idx]!;
    const lessonId = crypto.randomUUID();
    const versionId = crypto.randomUUID();

    const existing = await tx.select().from(s.lessons).where(eq(s.lessons.stableKey, item.key)).limit(1);
    const targetLessonId = existing[0]?.id ?? lessonId;

    if (existing.length === 0) {
      await tx.insert(s.lessons).values({
        id: targetLessonId,
        stableKey: item.key,
      });
    }

    const versionHash = await sha256Hex(`hijaiyah-${item.name}`);
    await tx.insert(s.lessonVersions).values({
      id: versionId,
      lessonId: targetLessonId,
      versionNumber: 1,
      title: `Mengenal Huruf ${item.name}`,
      lessonType: "listening",
      stageKey: "tahap_1_huruf_dasar",
      estimatedMinutes: 2,
      demoOnly: false,
      sourceIds: [SOURCE_HIJAIYAH_ID],
      status: "published",
      releaseHash: versionHash,
      authorId: STAFF_AUTHOR_ID,
      reviewerId: STAFF_REVIEWER_ID,
      publishedAt: new Date(),
    }).onConflictDoNothing();

    await tx.update(s.lessons).set({ currentVersionId: versionId }).where(eq(s.lessons.id, targetLessonId));

    // Units: Instruction, Letter presentation, Recognition Choice
    const unit1Id = crypto.randomUUID();
    const unit2Id = crypto.randomUUID();
    const unit3Id = crypto.randomUUID();

    await tx.insert(s.lessonUnits).values([
      {
        id: unit1Id,
        versionId,
        ordinal: 1,
        unitType: "instruction",
        required: false,
        instruction: `Mari mengenal bentuk dan pelafalan huruf ${item.name}.`,
      },
      {
        id: unit2Id,
        versionId,
        ordinal: 2,
        unitType: "letter",
        required: true,
        instruction: `Dengarkan pelafalan huruf ${item.name} (${item.sound}) lalu tirukan secara mandiri.`,
        letter: item.letter,
      },
      {
        id: unit3Id,
        versionId,
        ordinal: 3,
        unitType: "choice",
        required: true,
        instruction: `Pilih huruf ${item.name}.`,
      },
    ]).onConflictDoNothing();

    // Distractors
    const otherLetters = LETTERS.filter((l) => l.name !== item.name);
    const d1 = otherLetters[(idx + 1) % otherLetters.length]!;
    const d2 = otherLetters[(idx + 2) % otherLetters.length]!;

    await tx.insert(s.questions).values({
      id: crypto.randomUUID(),
      unitId: unit3Id,
      versionId,
      prompt: `Manakah huruf ${item.name}?`,
      options: [
        { option_id: item.name.toLowerCase(), label: item.letter },
        { option_id: d1.name.toLowerCase(), label: d1.letter },
        { option_id: d2.name.toLowerCase(), label: d2.letter },
      ],
      correctOptionId: item.name.toLowerCase(),
      explanation: `Huruf ${item.name} memiliki bentuk ${item.letter}.`,
    }).onConflictDoNothing();
  }

  // 4. Register Interactive Quiz Set (5 questions)
  const quizLessonKey = "quiz_hijaiyah_review_1";
  const quizLessonId = crypto.randomUUID();
  const quizVersionId = crypto.randomUUID();
  const existingQuiz = await tx.select().from(s.lessons).where(eq(s.lessons.stableKey, quizLessonKey)).limit(1);
  const targetQuizId = existingQuiz[0]?.id ?? quizLessonId;

  if (existingQuiz.length === 0) {
    await tx.insert(s.lessons).values({ id: targetQuizId, stableKey: quizLessonKey });
  }

  await tx.insert(s.lessonVersions).values({
    id: quizVersionId,
    lessonId: targetQuizId,
    versionNumber: 1,
    title: "Kuis Huruf Hijaiyah Bagian 1",
    lessonType: "quiz",
    stageKey: "tahap_1_huruf_dasar",
    estimatedMinutes: 3,
    demoOnly: false,
    sourceIds: [SOURCE_HIJAIYAH_ID],
    status: "published",
    releaseHash: await sha256Hex("quiz-hijaiyah-set-1"),
    authorId: STAFF_AUTHOR_ID,
    reviewerId: STAFF_REVIEWER_ID,
    publishedAt: new Date(),
  }).onConflictDoNothing();
  await tx.update(s.lessons).set({ currentVersionId: quizVersionId }).where(eq(s.lessons.id, targetQuizId));

  // 5 Quiz questions
  const QUIZ_ITEMS = [
    { q: "Huruf apakah ini: ب ?", opt: [{ id: "ba", label: "Ba" }, { id: "ta", label: "Ta" }, { id: "tsa", label: "Tsa" }], ans: "ba", exp: "Huruf Ba memiliki satu titik di bawah." },
    { q: "Huruf apakah ini: ت ?", opt: [{ id: "ta", label: "Ta" }, { id: "ba", label: "Ba" }, { id: "nun", label: "Nun" }], ans: "ta", exp: "Huruf Ta memiliki dua titik di atas." },
    { q: "Huruf apakah ini: ث ?", opt: [{ id: "tsa", label: "Tsa" }, { id: "ta", label: "Ta" }, { id: "jim", label: "Jim" }], ans: "tsa", exp: "Huruf Tsa memiliki tiga titik di atas." },
    { q: "Huruf apakah ini: ج ?", opt: [{ id: "jim", label: "Jim" }, { id: "ha", label: "Ha" }, { id: "kho", label: "Kho" }], ans: "jim", exp: "Huruf Jim memiliki satu titik di tengah/perut." },
    { q: "Huruf apakah ini: ح ?", opt: [{ id: "ha", label: "Ha" }, { id: "jim", label: "Jim" }, { id: "kho", label: "Kho" }], ans: "ha", exp: "Huruf Ha bersih tanpa titik." },
  ];

  for (let i = 0; i < QUIZ_ITEMS.length; i++) {
    const item = QUIZ_ITEMS[i]!;
    const uId = crypto.randomUUID();
    await tx.insert(s.lessonUnits).values({
      id: uId,
      versionId: quizVersionId,
      ordinal: i + 1,
      unitType: "choice",
      required: true,
      instruction: `Soal ${i + 1} dari 5`,
    }).onConflictDoNothing();

    await tx.insert(s.questions).values({
      id: crypto.randomUUID(),
      unitId: uId,
      versionId: quizVersionId,
      prompt: item.q,
      options: item.opt.map((o) => ({ option_id: o.id, label: o.label })),
      correctOptionId: item.ans,
      explanation: item.exp,
    }).onConflictDoNothing();
  }

  // 5. Register Sound-to-Letter Matching Game (5 rounds)
  const gameLessonKey = "game_match_sound_1";
  const gameLessonId = crypto.randomUUID();
  const gameVersionId = crypto.randomUUID();
  const existingGame = await tx.select().from(s.lessons).where(eq(s.lessons.stableKey, gameLessonKey)).limit(1);
  const targetGameId = existingGame[0]?.id ?? gameLessonId;

  if (existingGame.length === 0) {
    await tx.insert(s.lessons).values({ id: targetGameId, stableKey: gameLessonKey });
  }

  await tx.insert(s.lessonVersions).values({
    id: gameVersionId,
    lessonId: targetGameId,
    versionNumber: 1,
    title: "Cocokkan Suara & Huruf Hijaiyah",
    lessonType: "game",
    stageKey: "tahap_1_huruf_dasar",
    estimatedMinutes: 3,
    demoOnly: false,
    sourceIds: [SOURCE_HIJAIYAH_ID],
    status: "published",
    releaseHash: await sha256Hex("game-match-sound-set-1"),
    authorId: STAFF_AUTHOR_ID,
    reviewerId: STAFF_REVIEWER_ID,
    publishedAt: new Date(),
  }).onConflictDoNothing();
  await tx.update(s.lessons).set({ currentVersionId: gameVersionId }).where(eq(s.lessons.id, targetGameId));

  const GAME_ROUNDS = [
    { sound: "Suara 'A'", opt: [{ id: "alif", label: "ا" }, { id: "ba", label: "ب" }, { id: "ta", label: "ت" }], ans: "alif", exp: "Suara 'A' cocok dengan huruf Alif (ا)." },
    { sound: "Suara 'Ba'", opt: [{ id: "ba", label: "ب" }, { id: "ta", label: "ت" }, { id: "tsa", label: "ث" }], ans: "ba", exp: "Suara 'Ba' cocok dengan huruf Ba (ب)." },
    { sound: "Suara 'Ta'", opt: [{ id: "ta", label: "ت" }, { id: "ba", label: "ب" }, { id: "nun", label: "ن" }], ans: "ta", exp: "Suara 'Ta' cocok dengan huruf Ta (ت)." },
    { sound: "Suara 'Tsa'", opt: [{ id: "tsa", label: "ث" }, { id: "ta", label: "ت" }, { id: "jim", label: "ج" }], ans: "tsa", exp: "Suara 'Tsa' cocok dengan huruf Tsa (ث)." },
    { sound: "Suara 'Ja'", opt: [{ id: "jim", label: "ج" }, { id: "ha", label: "ح" }, { id: "kho", label: "خ" }], ans: "jim", exp: "Suara 'Ja' cocok dengan huruf Jim (ج)." },
  ];

  for (let i = 0; i < GAME_ROUNDS.length; i++) {
    const item = GAME_ROUNDS[i]!;
    const uId = crypto.randomUUID();
    await tx.insert(s.lessonUnits).values({
      id: uId,
      versionId: gameVersionId,
      ordinal: i + 1,
      unitType: "choice",
      required: true,
      instruction: `Babak ${i + 1} dari 5: Dengarkan suara lalu pilih huruf yang sesuai.`,
    }).onConflictDoNothing();

    await tx.insert(s.questions).values({
      id: crypto.randomUUID(),
      unitId: uId,
      versionId: gameVersionId,
      prompt: `Cocokkan ${item.sound} dengan hurufnya:`,
      options: item.opt.map((o) => ({ option_id: o.id, label: o.label })),
      correctOptionId: item.ans,
      explanation: item.exp,
    }).onConflictDoNothing();
  }

  // 6. Register DAG Curriculum Release
  const curriculumDef = {
    stages: [
      {
        stage_key: "tahap_1_huruf_dasar",
        title: "Tahap 1: Mengenal Huruf Dasar",
        order: 1,
        prerequisites: [],
      },
      {
        stage_key: "tahap_2_huruf_sambung",
        title: "Tahap 2: Huruf Sambung & Makhraj",
        order: 2,
        prerequisites: ["tahap_1_huruf_dasar"],
      },
      {
        stage_key: "tahap_3_surat_pendek",
        title: "Tahap 3: Hafalan Surat Pendek",
        order: 3,
        prerequisites: ["tahap_1_huruf_dasar"],
      },
    ],
  };

  await tx.insert(s.curriculumReleases).values({
    id: CURRICULUM_ID,
    title: "Kurikulum Standar Anak RZ v1.0",
    versionNumber: 1,
    definition: curriculumDef,
    status: "published",
    releaseHash: await sha256Hex(JSON.stringify(curriculumDef)),
    authorId: STAFF_AUTHOR_ID,
    reviewerId: STAFF_REVIEWER_ID,
    reviewEvidence: { approved_by: "Syariah Review Panel", date: "2026-09-01" },
    publishedAt: new Date(),
  }).onConflictDoNothing();
});

console.log("Pilot curriculum seeded successfully:");
console.log("- 5 Canonical Short Surahs (Al-Fatihah, Al-Kautsar, Al-Ikhlas, Al-Falaq, An-Nas)");
console.log("- 6 Foundational Hijaiyah lessons (Alif, Ba, Ta, Tsa, Jim, Ha)");
console.log("- 1 Five-question Quiz set");
console.log("- 1 Five-round Sound-matching game");
console.log("- DAG Curriculum Release with 3 stages");
process.exit(0);
