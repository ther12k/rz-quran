// T060: automated leak/abuse scan over the source tree and the built web
// bundle. Runs in the security project; the built-bundle checks execute when
// `apps/web/dist` exists (CI builds before scanning — see workflow order).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) acc.push(...walk(full, exts, acc.filter(() => false)));
    else if (exts.some((e) => entry.name.endsWith(e))) acc.push(full);
  }
  return acc;
}

const sourceFiles = [
  ...walk(join(ROOT, "apps/web/src"), [".ts", ".tsx", ".js", ".html"]),
  ...walk(join(ROOT, "apps/web/public"), [".js", ".json", ".html", ".webmanifest"]),
  ...walk(join(ROOT, "apps/api/src"), [".ts"]),
  ...walk(join(ROOT, "packages"), [".ts"]),
];

const sourceContents = sourceFiles.map((f) => ({ file: f, content: readFileSync(f, "utf8") }));

describe("T060: no third-party behavior recording in MVP source", () => {
  const TRACKER_PATTERNS = [
    /google-analytics\.com|googletagmanager\.com|\bgtag\(/i,
    /segment(\.io|\.com)\/analytics/i,
    /mixpanel\.com|amplitude\.com|hotjar\.com|clarity\.ms/i,
    /doubleclick\.net|adservice\.google\.com/i,
    /fullstory\.com|logrocket\.com|sentry\.io\/sdk/i,
    /facebook\.net\/.*sdk|connect\.facebook\.net/i,
  ];

  it("contains no tracker/ad/analytics/replay SDK references", () => {
    const hits = sourceContents
      .filter(({ content }) => TRACKER_PATTERNS.some((p) => p.test(content)))
      .map(({ file }) => file);
    expect(hits, `tracker references found: ${hits.join(", ")}`).toEqual([]);
  });

  it("contains no microphone/camera/speech-capture APIs", () => {
    const hits = sourceContents
      .filter(({ content }) =>
        /getUserMedia|MediaRecorder|webkitSpeechRecognition|SpeechRecognition\(/i.test(content),
      )
      .map(({ file }) => file);
    expect(hits, `capture APIs found: ${hits.join(", ")}`).toEqual([]);
  });

  it("keeps secrets out of the VITE_ namespace (browser-visible)", () => {
    const hits = sourceContents
      .filter(({ file, content }) => file.includes("apps/web") && /VITE_(SECRET|PASSWORD|DATABASE|AUTH_|KEY)/i.test(content))
      .map(({ file }) => file);
    expect(hits, `VITE_ secret usage found: ${hits.join(", ")}`).toEqual([]);
  });

  it("has no external child-facing outbound links (target=_blank in child area)", () => {
    const hits = sourceContents
      .filter(({ file, content }) => file.includes("apps/web/src") && content.includes('target="_blank"'))
      .map(({ file }) => file);
    expect(hits, `external links found: ${hits.join(", ")}`).toEqual([]);
  });

  it("keeps answer-key identifiers out of the web source", () => {
    const hits = sourceContents
      .filter(({ file, content }) => file.includes("apps/web") && /correct_option_id|correctOptionId/i.test(content))
      .map(({ file }) => file);
    expect(hits, `answer-key fields in web source: ${hits.join(", ")}`).toEqual([]);
  });
});

describe("T060: built web bundle scan (runs when dist exists)", () => {
  const distDir = join(ROOT, "apps/web/dist");
  const hasDist = existsSync(distDir);

  it.skipIf(!hasDist)("built bundle contains no answer keys", () => {
    const bundles = walk(distDir, [".js", ".css", ".html"]);
    const offenders = bundles.filter((f) => /correct_option_id|correctOptionId/i.test(readFileSync(f, "utf8")));
    expect(offenders, `answer keys leaked in: ${offenders.join(", ")}`).toEqual([]);
  });

  it.skipIf(!hasDist)("built bundle contains no tracker endpoints", () => {
    const bundles = walk(distDir, [".js", ".css", ".html"]);
    const offenders = bundles.filter((f) =>
      TRACKER_DOMAIN_RE.test(readFileSync(f, "utf8")),
    );
    expect(offenders, `tracker endpoints in: ${offenders.join(", ")}`).toEqual([]);
  });
});

const TRACKER_DOMAIN_RE = /google-analytics\.com|googletagmanager\.com|doubleclick\.net|hotjar\.com|clarity\.ms|mixpanel\.com|segment\.io/i;
