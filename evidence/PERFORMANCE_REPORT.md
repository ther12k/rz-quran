# Performance Measurement Report (T059)

**Measured:** 2026-09-05 · **Stack under test:** local dev machine (linux x64) — Vite 7 dev server (`:5181`) + Bun 1.4.0/Elysia (`:3310`) + PostgreSQL 16 (Docker, same host). **This is local-stack evidence, not production CDN measurements**; production re-measurement on real infra remains part of the launch checklist (D09).

## Mobile web-vitals profile (signed-in child home `/anak/beranda`)

Fixed test profile per PRD §3: emulated mobile 390×844 @2x, **CPU 4× throttle**, network **slow 4G** (1.6 Mbps ↓ / 750 kbps ↑ / 150 ms RTT) via CDP emulation.

| Metric | Budget | Measured | Result |
| --- | --- | --- | --- |
| LCP | ≤ 2500 ms | **1656 ms** | PASS |
| INP (input → next paint) | ≤ 200 ms | **41 ms** | PASS |
| CLS | ≤ 0.1 | **0.0000** | PASS |

Raw data: `evidence/perf-web-vitals.json` · measured by `tests/e2e/perf-budget.spec.ts` (web-vitals via PerformanceObserver; INP via direct input→next-rAF measurement because the headless shell omits Event Timing `interactionId`).

### Remediation performed during measurement
- **CLS 0.167 → 0.000**: the "Sedang menyiapkan…" one-liner collapsed into the loaded lesson card and pushed the page down. Replaced with a space-reserving skeleton (`min-h` + pulse placeholder matching the loaded card) and a section min-height, so late catalog data no longer shifts layout.
- INP was measured with a same-page button interaction (pointerdown → next two animation frames) under the throttled profile.

## API latency (authenticated read at concurrency)

`scripts/api-latency-bench.ts` — `GET /api/v1/me`, 50 concurrent sessions (PRD §3 target profile), 300 samples total.

| Metric | Budget | Measured | Result |
| --- | --- | --- | --- |
| p50 | — | 83 ms | — |
| p95 | < 500 ms | **175 ms** | PASS |
| p99 | — | 175 ms | — |
| Throughput | — | 552.6 req/s | — |
| Errors | 0 | 0 | PASS |

Raw data: `evidence/perf-api-latency.json`.

## Bundle budget

`bun run --filter @rzq/web build` → **99.77 KB gzipped JS** (budget ≤ 250 KB compressed, excluding on-demand media/fonts). PASS.

## Measurement conditions (reproducibility)

- **Dataset at measurement time (dev DB):** 14 published lesson versions, 25 canonical verses (5 surahs), 1 child profile with single-digit learning events — small demo scale; timings do not project to production data volumes.
- **Cache state:** fresh Playwright browser context per run (cold HTTP cache; dev server, no service worker); API bench used pre-established authenticated sessions, single Bun process, PostgreSQL pool per worker.
- **Run structure:** web vitals — one instrumented run per viewport project (5 viewports) on `/anak/beranda`, PerformanceObserver samples (INP via input→next-rAF proxy: headless Chromium omits Event Timing `interactionId`); API bench — 50 concurrent workers, 300 samples total, zero errors. Raw JSON: `evidence/perf-web-vitals.json`, `evidence/perf-api-latency.json`.
- **Scope label:** laboratory (scripted) measurements under the emulated profile above — not field/RUM data. No real-user telemetry exists (and none is permitted for children).

## Not measured here (honest gaps)

- Production-region LCP/INP/CLS behind a real CDN with self-hosted fonts.
- Media-transfer latency (no licensed audio assets exist yet — rights pending, T063).
- These remain launch-checklist items on real infrastructure.
