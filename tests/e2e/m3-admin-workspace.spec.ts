import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const SCREENSHOT_DIR = join(process.cwd(), "evidence/screenshots");

test.beforeAll(async () => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
});

test("M3 Staff Editorial Workspace Journey", async ({ page }) => {
  const width = page.viewportSize()?.width ?? 1440;
  const prefix = `w${width}`;

  // Setup verified staff members in DB
  const sql = postgres("postgresql://rzq:local_only@127.0.0.1:5433/quran_kids");

  const email = `staff-${Date.now()}-${width}@example.com`;
  const password = "kata-sandi-aman-123";

  // Sign up staff user through UI
  await page.goto("http://localhost:5181/daftar");
  await page.fill('input[autocomplete="name"]', "Editor Utama");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait until the sign-up POST completes (verification pending screen)
  await expect(page.locator("h1")).toContainText("Periksa email kamu");

  // Mark email verified and assign staff capabilities
  await sql`UPDATE "user" SET email_verified = true WHERE email = ${email}`;
  const userId = await sql`SELECT id FROM "user" WHERE email = ${email}`;
  if (!userId[0]) throw new Error(`user not found: ${email}`);
  await sql`
    INSERT INTO staff_members (auth_user_id, capabilities, active)
    VALUES (${userId[0].id}, ARRAY['content_editor', 'content_reviewer', 'content_publisher', 'ops_admin']::text[], true)
    ON CONFLICT (auth_user_id) DO UPDATE SET active = true;
  `;

  // Sign in
  await page.goto("http://localhost:5181/masuk");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for the signed-in redirect (gate page appears for parents)
  await expect(page.locator("h1")).toContainText("Minta bantuan orang tua");
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Buka area orang tua")');
  // Gate unlocks and router shows parent onboarding; admin route is staff-gated only.
  await expect(page.locator("h1")).toContainText("Menyiapkan belajar anak");

  // 1. Staff Admin Workspace
  await page.goto("http://localhost:5181/admin");
  await expect(page.locator("h1")).toContainText("Ruang Editorial");
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-m3-01-admin-drafts-tab.png`), fullPage: true });

  // 2. Sources & Rights Registry Tab
  await page.click('button:has-text("Sumber & Hak Cipta")');
  await expect(page.locator("h2")).toContainText("Registri Sumber");
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-m3-02-sources-registry.png`), fullPage: true });

  // 3. Asset Quarantine Tab
  await page.click('button:has-text("Karantina Aset")');
  await expect(page.locator("h2")).toContainText("Karantina Aset Media");
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-m3-03-assets-quarantine.png`), fullPage: true });

  // 4. Instant Recall Tab
  await page.click('button:has-text("Penarikan Seketika")');
  await expect(page.locator("h2")).toContainText("Penarikan Materi Seketika");
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-m3-04-recall.png`), fullPage: true });

  // 5. Audit Trail Tab
  await page.click('button:has-text("Jejak Audit")');
  await expect(page.locator("h2")).toContainText("Jejak Audit Editorial");
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${prefix}-m3-05-audit-trail.png`), fullPage: true });

  await sql.end();
});
