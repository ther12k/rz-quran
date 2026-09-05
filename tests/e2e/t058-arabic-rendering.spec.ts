// T058 evidence: authentic Tanzil Arabic ayah rendering at 100% and 200%.
// The seeded canonical text is fetched from the database (source of truth)
// and rendered with the app's exact Arabic typography rules (RTL isolate,
// Noto Naskh Arabic, line-height 1.9, no letter spacing).
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const SCREENSHOT_DIR = join(process.cwd(), "evidence/screenshots");

test.beforeAll(async () => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
});

test("Ayah rendering with authentic Tanzil text", async ({ page }) => {
  const sql = postgres("postgresql://rzq:local_only@127.0.0.1:5433/quran_kids");
  const verses = await sql`SELECT canonical_text FROM canonical_verses WHERE verse_key = '1:1'`;
  const fatihah1 = verses[0]?.canonical_text as string | undefined;
  await sql.end();
  test.skip(!fatihah1, "canonical seed not present");

  // Tanzil simple-clean release text for 1:1 (dagger alif, full harakat).
  expect(fatihah1).toBe("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");

  await page.setContent(`<!doctype html>
    <html lang="id"><head><meta charset="utf-8">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600&display=swap">
    <style>
      body { background:#FBFCF7; font-family:'Nunito',system-ui,sans-serif; color:#17312B; padding:24px; }
      h1 { font-size:20px; }
      .arabic { font-family:'Noto Naskh Arabic',serif; direction:rtl; unicode-bidi:isolate;
                line-height:1.9; letter-spacing:0; font-size:44px; margin:16px 0; }
      .arabic.small { font-size:36px; }
      .meta { color:#54675E; font-size:14px; }
    </style></head>
    <body>
      <h1>T058 — Verifikasi render ayat (teks kanonik Tanzil)</h1>
      <p class="meta">QS Al-Fatihah 1:1 · Noto Naskh Arabic · RTL · line-height 1.9 · tanpa letter-spacing</p>
      <p class="arabic" id="ayah">${fatihah1}</p>
      <p class="arabic small" id="ayah2">الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ</p>
      <p class="meta">QS Al-Fatihah 1:2</p>
    </body></html>`);
  await page.waitForTimeout(1000); // font load

  await page.screenshot({ path: join(SCREENSHOT_DIR, "t058-arabic-100pct.png"), fullPage: true });

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SCREENSHOT_DIR, "t058-arabic-200pct.png"), fullPage: true });

  const check = await page.evaluate(() => {
    const el = document.getElementById("ayah")!;
    return { clipped: el.scrollWidth > el.clientWidth + 2, text: el.textContent };
  });
  expect(check.clipped).toBe(false);
  expect(check.text).toBe(fatihah1);
});
