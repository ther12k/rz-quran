# UI vs. Handoff Mockups — Honest Delta Record (2026-09-05)

Method: fresh 390×844 captures of the running demo environment
(`scripts/capture-mockup-compare.ts`, demo parent, child "Aisyah"),
side-by-side with `design/mockups/01–06`. Captures: `impl-*.png` here.

## Verdict

**Structurally faithful, visually plainer.** Layout architecture, navigation,
flows, color system (cream background, green primary, mint/sunny pastels,
rounded cards, 48px touch targets), content model, and every interactive
state match the mockups and are real (no fake screens). The visible gap is
concentrated in **illustration richness**: the mockups use 3D
claymation-style mascots, illustrated letter tiles, decorative scenes, and
character-based feedback; the implementation deliberately ships flat cards,
typography, and emoji/text icons because production artwork is license-gated
(open issue **T066 — artwork licensing**). Per AGENTS.md, no unlicensed
artwork may be shipped, so this delta is intentional, not drift.

## Pair-by-pair

| # | Mockup | Implemented | Matches | Delta |
|---|--------|-------------|---------|-------|
| 01 | Home: claymation scene, hero card w/ mascot, 8 icon cards, bottom tabs | Child home: greeting + star count, continue-lesson card, activity pills, bottom tabs | Layout, nav, color, copy tone | No illustrated hero/mascot (T066); cards are text+emoji vs 3D tiles |
| 02 | Catalog: search, chips, section headers, cards w/ progress rings | Catalog: search, Tahap chips, stage headers, cards w/ Arabic titles, lock/play states | Structure + states incl. DAG locks | Flat cards, no illustrated tiles/progress rings |
| 03 | Surah practice: big Arabic card, star meter, repeat controls, cozy scene | Surah player: authentic Tanzil Arabic (Noto Naskh, RTL, no letter-spacing), step X/7, progress bar, repeat 1×/3×, honest audio-unavailable note | Content + controls complete | No decorative scene; progress bar vs star meter |
| 04 | Quiz: mascot question banner, 3D answer tiles, character feedback | Quiz: question, 4 options, instant feedback, progress | Flow complete | Flat styling, no mascot |
| 05 | Hijaiyah game: bubbles, 3D letter tiles, round indicator | Game: sound-round prompt, options, round counter | Flow complete | Flat styling, no 3D tiles |
| 06 | Parent dashboard: stat cards, bar/donut charts, activity timeline | Parent progress: 3 tabs, stat numbers, lesson history, assessments | Data complete | **No charts** (implementable, not license-gated) |

## Gap classification

1. **Gated on T066 (artwork licensing)** — mascots, illustrated tiles,
   decorative scenes, character feedback. Cannot be closed without verified
   artwork rights.
2. **Implementable polish (no license needed)** — (a) simple SVG/CSS charts
   on the parent dashboard; (b) richer child-home hero card composition;
   (c) illustrated-style tab bar icons drawn as original in-house SVG.
3. **Already fixed during this review session**:
   - Unknown API routes returned 500; now honest 404 (`apps/api/src/index.ts`).
   - Opening a second lesson while one is active showed a misleading
     "material unavailable" note; now an honest resume screen that jumps to
     the first unfinished unit (`apps/web/src/pages/lesson-player.tsx`).
   - Gate rate limit counted successful unlocks; a parent toggling
     child/parent areas (S15) was locked out after 5 unlocks. Now only
     failures consume the budget (`apps/api/src/rate-limit.ts`,
     `identity.ts`; regression tests in `m4-privacy-hardening.test.ts`).
