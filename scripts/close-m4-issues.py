#!/usr/bin/env python3
"""Close completed M4 issues; add honest progress notes on the remaining ones."""
import subprocess
import time

REPO = "ther12k/rz-quran"

CLOSE = {
    "T052": """### Implemented & Tested Evidence
- **Withdrawal endpoints**: `POST /api/v1/parent/consents/withdraw` (family + child scope) in `apps/api/src/modules/privacy.ts`. Withdrawal immediately expires all active/paused learning sessions for the affected profile(s).
- **Enforcement**: child-mode entry and all learning writes check effective consent; withdrawal blocks with `CONSENT_REQUIRED` until a new approved-flow grant.
- **Tests**: family + child withdrawal both verified in `tests/api/m4-privacy-hardening.test.ts` (entry blocked with 403 after withdrawal).""",

    "T053": """### Implemented & Tested Evidence
- **Export job**: `POST /api/v1/parent/exports` (one active export per parent, idempotent), worker completion in `apps/api/src/jobs/worker.ts` (24h validity), owner-gated `GET /parent/jobs/:id` + download endpoint assembling only this parent's family data (children, progress, stars, consent ledger, assessments) — no answer keys, no reviewer data, no other families' rows.
- **Tests**: job queue + cross-parent job access returns 404 (verified in `tests/api/m4-privacy-hardening.test.ts`).""",

    "T054": """### Implemented & Tested Evidence
- **Deletion transaction**: `DELETE /api/v1/parent/children/:childId` atomically (1) expires sessions, (2) resets session controls, (3) writes the suppression ledger row **before** the row delete, (4) cascades events/progress/rewards away.
- **Suppression ledger**: new `deletion_suppressions` table (migration `0002_omniscient_gorgon.sql`) keyed by scope+reference — a backup restore can never resurrect the profile.
- **Tests**: delete → enter returns 404, ledger row present, replay safe (verified in `tests/api/m4-privacy-hardening.test.ts`).""",

    "T055": """### Implemented & Tested Evidence
- **Shared rate limiting**: `apps/api/src/rate-limit.ts` with PostgreSQL fixed-window buckets (migration `0003`), effective across API replicas. Gate: 5 attempts/15 min per account.
- **Origin/CSRF**: Better Auth origin validation (`trustedOrigins`) + same-origin Vite proxy; production CORS denied by default (docs/03 §3).
- **Tests**: 6th failed gate attempt returns 429 `RATE_LIMITED` (verified in `tests/api/m4-privacy-hardening.test.ts`).""",

    "T056": """### Implemented & Tested Evidence
- **Installable shell**: `apps/web/public/sw.js` caches ONLY static shell + hashed assets; `/api/*` and media are never intercepted (FR-16). `manifest.webmanifest` + theme color wired; registration in production builds only.
- **Offline honesty**: cold-offline shows cached shell with the app's offline message; no full-offline claims.""",

    "T057": """### Implemented & Tested Evidence
- **Browser audit**: `tests/e2e/m4-accessibility.spec.ts` verifying landmark structure, visible keyboard focus, chart table alternative — passing on 390/768/1440.
- **Responsive captures**: full journey screenshots at 390/768/1440 in `evidence/screenshots/` (M1 set + M3 admin set).
- **Note**: 320px and 1024px captures plus iOS Safari/Android Chrome device-lab passes remain for the pre-launch manual checklist (tracked under M5 regression).""",

    "T058": """### Implemented & Tested Evidence
- **Canonical integrity**: seeded Tanzil simple-clean text byte-verified against the release (`tests/e2e/t058-arabic-rendering.spec.ts` asserts exact 1:1 text incl. dagger alif).
- **Rendering checks**: RTL isolation, Noto Naskh Arabic, line-height 1.9, no letter-spacing, no clipping at 200% zoom — captured in `evidence/screenshots/t058-arabic-100pct.png` and `t058-arabic-200pct.png`.
- **Note**: multi-device (iOS Safari/Android Chrome) font verification remains for the pre-launch manual checklist.""",

    "T061": """### Implemented & Tested Evidence
- **Idempotent worker**: `apps/api/src/jobs/worker.ts` — PostgreSQL leases (`FOR UPDATE SKIP LOCKED`), attempt counters, idempotent handlers for `asset_verify` and `export`.
- **Readiness**: `/readyz` DB check; `bun run check:production-readiness` fails closed on demo mode/missing policy (CI-verified).
- **Honest boundary**: real production environment provisioning + rollback drill remain blocked on D09 (hosting decision) — tracked in T062 and the M5 gate; no deployment was performed.""",

    "T073": """### Implemented & Tested Evidence
- **Concurrency suite**: `tests/api/m4-privacy-hardening.test.ts` runs 5 parallel finish calls against real PostgreSQL — at most one star awarded, at most one reward row (DB-verified).
- **Replay invariants**: idempotency-key conflict, event-ID conflict, sequence gaps — all covered in `tests/security/isolation.test.ts` + M1/M2 suites.
- **Zero-denominator/timezone**: honest "Belum ada kuis" (null accuracy) and timezone-snapshot bucketing covered in M1 tests.""",

    "T074": """### Implemented & Tested Evidence
- **State coverage implemented**: loading (`Sedang menyiapkan…`), empty catalog (`Materi belum ditemukan`), no-content home, gate-required (403 → gate UI), expired gate, recall (410 → `Materi ini sedang diperiksa`), offline notice, pending-save disabled states — across child/parent/admin surfaces.
- **Verified by**: Playwright journeys (9 passing) + integration/security suites exercising denied/expired/recalled paths.""",
}

COMMENT_ONLY = {
    "T059": """### Progress (not complete)
- Bundle measured: **99.77 KB gzipped** JS (budget 250 KB) — `bun run --filter @rzq/web build`.
- LCP/INP/CLS **not yet measured** on the fixed mobile profile; API p95 latency not yet benchmarked.
Remaining: field/perf-lab measurements before launch. Keeping open.""",
    "T060": """### Scan evidence (partial)
- Static scan clean: no tracking/analytics SDKs, no `getUserMedia`/MediaRecorder, no `VITE_` secrets, no `correct_option_id` in the web bundle, no external child-facing links.
Remaining: automated scan in CI + dependency/secret scanner integration before launch. Keeping open.""",
    "T062": """### Blocked on environment
Restore + deletion-replay drills require a real staging/production backup environment, which is blocked on D09 (hosting decision). Suppression-ledger replay logic is implemented and unit-verified (T054); the operational drill remains. Keeping open.""",
}

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)

def main():
    import json
    issues = json.loads(sh("gh", "issue", "list", "-R", REPO, "--state", "open", "--limit", "100", "--json", "number,title").stdout or "[]")
    closed = commented = 0
    for issue in issues:
        num, tid = issue["number"], issue["title"].split(" ")[0]
        if tid in CLOSE:
            sh("gh", "issue", "comment", str(num), "-R", REPO, "-b", CLOSE[tid])
            sh("gh", "issue", "close", str(num), "-R", REPO, "-r", "completed")
            closed += 1
            print(f"closed {tid} (#{num})")
            time.sleep(0.5)
        elif tid in COMMENT_ONLY:
            sh("gh", "issue", "comment", str(num), "-R", REPO, "-b", COMMENT_ONLY[tid])
            commented += 1
            print(f"commented {tid} (#{num})")
            time.sleep(0.5)
    print(f"closed={closed} commented={commented}")

if __name__ == "__main__":
    main()
