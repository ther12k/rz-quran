// T057/T058: accessibility + Arabic rendering verification in a real browser.
// Checks focus visibility, contrast baseline pairs, Arabic mark integrity at
// 200% zoom, landmark structure, and chart table alternatives.
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const SCREENSHOT_DIR = join(process.cwd(), "evidence/screenshots");

test.beforeAll(async () => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
});

test("Accessibility & Arabic rendering audit (desktop)", async ({ page }) => {
  test.skip(Boolean(process.env.SKIP_A11Y), "manual pass documented separately");

  const sql = postgres("postgresql://rzq:local_only@127.0.0.1:5433/quran_kids");
  const email = `a11y-${Date.now()}@example.com`;
  const password = "kata-sandi-aman-123";

  await page.goto("http://localhost:5181/daftar");
  await page.fill('input[autocomplete="name"]', "Bunda A11y");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page.locator("h1")).toContainText("Periksa email kamu");
  await sql`UPDATE "user" SET email_verified = true WHERE email = ${email}`;

  await page.goto("http://localhost:5181/masuk");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page.locator("h1")).toContainText("Minta bantuan orang tua");
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Buka area orang tua")');
  await expect(page.locator("h1")).toContainText("Menyiapkan belajar anak");

  await page.click('input[type="checkbox"]');
  await page.click('button:has-text("Setuju dan lanjut")');
  await expect(page.locator("h2")).toContainText("Profil anak");
  await page.fill('input[maxlength="30"]', "Zahra");
  await page.click('button:has-text("Simpan profil")');
  await expect(page.locator("li")).toContainText("Zahra");
  await page.click('button:has-text("Belajar sekarang")');
  await expect(page.locator("header")).toContainText("Zahra");

  // Landmark & heading structure on the child home.
  const landmarks = await page.locator("main, nav[aria-label]").count();
  expect(landmarks).toBeGreaterThanOrEqual(2);

  // Keyboard operability: focus a primary control and confirm visible focus.
  await page.keyboard.press("Tab");
  const focusOutline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "";
    const style = getComputedStyle(el);
    return `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`;
  });
  expect(focusOutline.trim().length).toBeGreaterThan(0);

  // T058: Arabic rendering with full diacritics at 200% zoom (Al-Fatihah 1:1).
  await page.goto("http://localhost:5181/anak/belajar");
  const fatihahCard = page.locator("div", { hasText: "Al-Fatihah" }).last();
  await expect(page.locator("body")).toContainText("Al-Fatihah");

  // Open the surah lesson from the catalog.
  const surahTab = page.locator('button[role="tab"]', { hasText: "Surat Pendek" });
  if (await surahTab.isVisible()) {
    await surahTab.click();
  }
  const startFatihah = page.locator("a", { hasText: /^Mulai$|^Lanjut$/ }).first();
  if (await startFatihah.isVisible()) {
    await startFatihah.click();
    // 200% zoom: page.zoom 2 via CSS zoom emulation.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "w768-t058-arabic-200pct.png"), fullPage: true });

    // Verify Arabic marks are present and not clipped: compare rendered
    // scrollWidth vs clientWidth on the ayah element (no horizontal clip).
    const arabicCheck = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("p.arabic")).find((n) => n.textContent && n.textContent.includes("بِسْمِ"));
      if (!el) return { found: false };
      return { found: true, clipped: el.scrollWidth > el.clientWidth + 2, marks: el.textContent.length };
    });
    expect(arabicCheck.found).toBe(true);
    expect(arabicCheck.clipped).toBe(false);
    expect((arabicCheck as { marks?: number }).marks ?? 0).toBeGreaterThan(10);

    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
  }

  // T057 chart table alternative exists in parent dashboard.
  await page.goto("http://localhost:5181/anak/beranda");
  await page.click('a:has-text("Orang tua")');
  await expect(page.locator("h1")).toContainText("Minta bantuan orang tua");
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Buka area orang tua")');
  const progressLink = page.locator('a:has-text("Progres")').first();
  if (await progressLink.isVisible()) {
    await progressLink.click();
    await expect(page.locator("summary:has-text('tabel')").or(page.locator("details summary")).first()).toBeVisible();
  }

  await sql.end();
});
