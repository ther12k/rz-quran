// T060 runtime outbound evidence (acceptance reconciliation): during a real
// child learning journey the browser must talk only to first-party origins,
// never request microphone/notification permissions, and open no popups.
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5181";
const EMAIL = "demo@rzq.local";
const PASSWORD = "demo-sandi-123";

test("child journey: first-party traffic only, no capture or notification prompts", async ({ page }) => {
  const violations: string[] = [];
  const permissionCalls: string[] = [];

  await page.addInitScript(() => {
    const record = (name: string) => {
      const w = window as unknown as { __permissionCalls?: string[] };
      w.__permissionCalls = w.__permissionCalls ?? [];
      w.__permissionCalls.push(name);
    };
    if (navigator.mediaDevices) {
      const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (...args: Parameters<typeof orig>) => {
        record("getUserMedia");
        return orig(...args);
      };
    }
    const Notif = (window as unknown as { Notification?: { requestPermission?: (...a: unknown[]) => unknown } }).Notification;
    if (Notif?.requestPermission) {
      const orig = Notif.requestPermission.bind(Notif);
      Notif.requestPermission = (...args: unknown[]) => {
        record("Notification.requestPermission");
        return orig(...args);
      };
    }
    window.open = () => {
      record("window.open");
      return null;
    };
  });

  const firstParty = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname === "localhost" || u.hostname === "127.0.0.1";
    } catch {
      return true; // data:, blob:, about: — same-document assets
    }
  };

  page.on("request", (req) => {
    if (!firstParty(req.url())) violations.push(req.url());
  });
  page.on("popup", () => violations.push("popup-opened"));

  // Full journey: sign in → gate → child mode → home → catalog → lesson.
  await page.goto(`${BASE}/masuk`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  await page.goto(`${BASE}/orang-tua/anak`);
  await page.locator('input[type="password"], li:has-text("Aisyah")').first().waitFor({ timeout: 15000 });
  const gateInput = page.locator('input[type="password"]');
  if (await gateInput.count()) {
    await gateInput.first().fill(PASSWORD);
    await page.click('button:has-text("Buka area orang tua")');
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/orang-tua/anak`);
  }
  await page.locator('li:has-text("Aisyah") button').last().click();
  await page.waitForURL("**/anak/**", { timeout: 15000 });

  await page.goto(`${BASE}/anak/belajar`);
  await page.waitForLoadState("networkidle");
  const anyLesson = page.locator('a[href^="/anak/belajar/"]').first();
  if (await anyLesson.count()) {
    await anyLesson.click();
    await page.waitForLoadState("networkidle");
  }
  await page.waitForTimeout(1500);

  const recorded = await page.evaluate(() => (window as unknown as { __permissionCalls?: string[] }).__permissionCalls ?? []);
  permissionCalls.push(...recorded);

  expect(violations, "non-first-party requests").toEqual([]);
  expect(permissionCalls, "browser permission/popup usage").toEqual([]);
});
