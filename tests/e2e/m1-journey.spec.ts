import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const SCREENSHOT_DIR = join(process.cwd(), "evidence/screenshots");

test.beforeAll(async () => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
});

test("M1 Visual & Interaction Journey", async ({ page }) => {
  page.on("console", (msg) => console.log("[BROWSER]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("[BROWSER ERR]", err));
  page.on("response", async (res) => {
    if (res.url().includes("/api/")) {
      console.log("[API RES]", res.status(), res.url(), (await res.text()).slice(0, 100));
    }
  });

  const width = page.viewportSize()?.width ?? 390;
  const prefix = `w${width}`;

  // 1. S01: Public Landing Page
  await page.goto("http://localhost:5181/");
  await expect(page.locator("h1")).toContainText("Semua yang Dibutuhkan Anak");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-01-landing.png`), fullPage: true });

  // 2. S02: Sign-up / Sign-in form
  await page.goto("http://localhost:5181/daftar");
  await expect(page.locator("h1")).toContainText("Buat akun orang tua");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-02-auth-signup.png`), fullPage: true });

  const email = `parent-${Date.now()}-${width}@example.com`;
  const password = "kata-sandi-aman-123";

  await page.fill('input[autocomplete="name"]', "Bunda Sarah");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Verify pending notice is shown
  await expect(page.locator("h1")).toContainText("Periksa email kamu");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-02b-verify-pending.png`), fullPage: true });

  // Mark email as verified directly in database for realistic progression
  const sql = postgres("postgresql://rzq:local_only@127.0.0.1:5433/quran_kids");
  await sql`UPDATE "user" SET email_verified = true WHERE email = ${email}`;

  // Now sign in
  await page.goto("http://localhost:5181/masuk");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // 3. S15: Server enforces Parent Gate upon accessing /orang-tua
  await expect(page.locator("h1")).toContainText("Minta bantuan orang tua");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-03-parent-gate.png`), fullPage: true });

  // Unlock parent gate
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Buka area orang tua")');

  // 4. S03: Consent step (auto-navigated from gate)
  await expect(page.locator("h1")).toContainText("Menyiapkan belajar anak");
  await expect(page.locator("h2")).toContainText("Persetujuan sebelum membuat profil anak");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-04-consent-step.png`), fullPage: true });

  // Grant demo consent via checkbox & button
  await page.click('input[type="checkbox"]');
  await page.click('button:has-text("Setuju dan lanjut")');

  // 5. S04: Child profile creation
  await expect(page.locator("h2")).toContainText("Profil anak");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-05-child-creation-empty.png`), fullPage: true });

  await page.fill('input[maxlength="30"]', "Aisyah");
  await page.click('button:has-text("Bintang")');
  await page.click('button:has-text("5–7 tahun")');
  await page.click('button:has-text("Simpan profil")');

  // Wait for child profile card to appear
  await expect(page.locator("li")).toContainText("Aisyah");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-06-child-profile-created.png`), fullPage: true });

  // 6. Enter Child Mode -> S05: Child Home
  await page.click('button:has-text("Belajar sekarang")');
  await expect(page.locator("header")).toContainText("Assalamu'alaikum, Aisyah!");
  await expect(page.locator('p:has-text("Pelajaran")').or(page.locator('h2:has-text("Pilih kegiatan")'))).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-07-child-home.png`), fullPage: true });

  // 7. S07: Lesson Player
  await page.click('button:has-text("Ayo mulai belajar"), button:has-text("Lanjut belajar")');
  await expect(page.locator("h1")).toContainText("Mengenal Huruf");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-08-lesson-step-instruction.png`), fullPage: true });

  // Click Mulai
  if (await page.locator('button:has-text("Mulai")').isVisible()) {
    await page.click('button:has-text("Mulai")');
  }

  // Next step: Letter Ba
  await expect(page.locator(".arabic")).toBeVisible();
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-09-lesson-step-letter.png`), fullPage: true });
  await page.click('button:has-text("Sudah berlatih")');

  // Advance to question
  await page.waitForTimeout(500);
  if (await page.locator('button:has-text("Sudah berlatih")').isVisible()) {
    await page.click('button:has-text("Sudah berlatih")');
    await page.waitForTimeout(500);
  }

  // Answer question if visible
  if (await page.locator('button.arabic').first().isVisible()) {
    await page.locator('button.arabic').first().click();
    await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-10-lesson-quiz-selected.png`), fullPage: true });
    await page.click('button:has-text("Periksa")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-11-lesson-quiz-feedback.png`), fullPage: true });
    await page.click('button:has-text("Lanjut")');
    await page.waitForTimeout(500);
  }

  // 8. Return to Child Home, click "Orang tua", unlock Gate
  await page.goto("http://localhost:5181/anak/beranda");
  await page.click('a:has-text("Orang tua")');
  await expect(page.locator("h1")).toContainText("Minta bantuan orang tua");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-12-parent-gate-return.png`), fullPage: true });

  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Buka area orang tua")');

  // 9. S16: Parent Progress View
  await expect(page.locator("li")).toContainText("Aisyah");
  await page.click('a:has-text("Progres")');
  await expect(page.locator("h1")).toContainText("Area Orang Tua");
  await expect(page.locator('p:has-text("Pelajaran selesai")')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-13-parent-progress.png`), fullPage: true });

  await sql.end();
});
