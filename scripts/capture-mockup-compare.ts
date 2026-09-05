// Capture current 390px screenshots of the screens matching the six handoff
// mockups, using the live demo environment (http://localhost:5181).
// Run: bun scripts/capture-mockup-compare.ts
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:5181";
const CHILD_ID = "eee8e412-eaeb-4aaf-ad34-2c6d9c476dc3";
const PASSWORD = "demo-sandi-123";
const LESSONS = {
  fatihah: "b4f71e1a-4892-4008-b5c3-5193fe7a4b05",
  quiz: "e0cc41b0-7990-4db2-bd0f-7c4f9db73fa1",
  game: "ca69d173-f31f-4871-8607-1b256906d435",
};
const OUT = "evidence/mockup-compare";

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const shot = (name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

  // Sign in as the demo parent.
  await page.goto(`${BASE}/masuk`);
  await page.fill('input[type="email"]', "demo@rzq.local");
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  // Parent area forces the gate; unlock it explicitly before any gated API call.
  await page.goto(`${BASE}/orang-tua/anak`);
  await page.locator('input[type="password"], li:has-text("Aisyah")').first().waitFor({ timeout: 15000 });
  const gateInput = page.locator('input[type="password"]');
  if (await gateInput.count()) {
    await gateInput.first().fill(PASSWORD);
    await page.click('button:has-text("Buka area orang tua")');
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}/orang-tua/anak`);
  }
  await page.waitForLoadState("networkidle");
  try {
    await page.locator('li:has-text("Aisyah")').waitFor({ timeout: 10000 });
  } catch {
    console.log("STUCK URL:", page.url());
    console.log("STUCK BODY:", (await page.locator("body").innerText()).slice(0, 400));
    throw new Error("profile list never appeared");
  }
  console.log("gate open, profile list visible");

  // Unlock the three mockup lessons via the app's own parent-selected-start
  // feature so the surah/quiz/game screens are playable for the review.
  for (const id of [LESSONS.fatihah, LESSONS.quiz, LESSONS.game]) {
    const res = await page.request.post(`${BASE}/api/v1/parent/children/${CHILD_ID}/stage-overrides`, {
      data: { lesson_id: id, reason: "parent_selected_start" },
    });
    console.log("override", id.slice(0, 8), res.status());
  }

  // Enter child mode for Aisyah from the profile list.
  const enterBtn = page.locator(`li:has-text("Aisyah") button`).last();
  try {
    await enterBtn.click({ timeout: 8000 });
  } catch {
    console.log("buttons on page:", await page.locator("button").allTextContents());
    throw new Error("enter-child button not found");
  }
  await page.waitForURL("**/anak/**", { timeout: 10000 });
  await page.waitForLoadState("networkidle");
  await shot("impl-01-child-home");

  // Catalog.
  await page.goto(`${BASE}/anak/belajar`);
  await page.waitForLoadState("networkidle");
  await shot("impl-02-catalog");

  // Release the child's active session the way the product intends: leave
  // child mode via the parent gate, replace the session as the parent, then
  // re-enter child mode. (No child-side abandon exists by design.)
  const releaseSession = async () => {
    await page.goto(`${BASE}/gerbang-orang-tua`);
    await page.locator('button:has-text("Buka area orang tua")').waitFor({ timeout: 15000 });
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.click('button:has-text("Buka area orang tua")');
    await page.waitForTimeout(2000);
    const res = await page.request.post(`${BASE}/api/v1/parent/children/${CHILD_ID}/replace-session`, { data: {} });
    console.log("replace-session", res.status());
    await page.goto(`${BASE}/orang-tua/anak`);
    await page.locator('li:has-text("Aisyah")').waitFor({ timeout: 15000 });
    await page.locator(`li:has-text("Aisyah") button`).last().click();
    await page.waitForURL("**/anak/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
  };
  await releaseSession();

  // Quiz (mockup 04): start, pick the first option, capture feedback.
  await page.goto(`${BASE}/anak/belajar/${LESSONS.quiz}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const option = page.locator('[role="group"] button').first();
  if (await option.count()) {
    await option.click();
    await page.waitForTimeout(600);
  }
  await shot("impl-04-quiz");
  await releaseSession();

  // Game (mockup 05): start and capture the first round.
  await page.goto(`${BASE}/anak/belajar/${LESSONS.game}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await shot("impl-05-game");
  await releaseSession();

  // Surah player (mockup 03) — leave its session active.
  await page.goto(`${BASE}/anak/belajar/${LESSONS.fatihah}`);
  await page.waitForLoadState("networkidle");
  await shot("impl-03-surah-player");

  // With the surah session active, the quiz must offer an honest resume path.
  await page.goto(`${BASE}/anak/belajar/${LESSONS.quiz}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await shot("impl-04b-session-resume");
  const resume = page.locator('button:has-text("Lanjutkan Latihan")');
  if (await resume.count()) {
    await resume.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await shot("impl-03b-resumed");
  }
  await releaseSession();

  // Parent progress (mockup 06): return via gate from child mode.
  await page.goto(`${BASE}/orang-tua/anak/${CHILD_ID}/progres`);
  await page.waitForLoadState("networkidle");
  const gateBack = page.locator('input[type="password"]');
  if (await gateBack.count()) {
    await shot("impl-06a-gate-return");
    await gateBack.first().fill(PASSWORD);
    const unlock = page.locator('button:has-text("Buka area orang tua")');
    if (await unlock.count()) await unlock.click();
    await page.waitForLoadState("networkidle");
  }
  await shot("impl-06-parent-progress");

  await browser.close();
  console.log("done ->", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
