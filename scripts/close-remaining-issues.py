#!/usr/bin/env python3
"""Close T059/T060/T062 with fresh evidence; update T066 and T068 progress."""
import subprocess
import time

REPO = "ther12k/rz-quran"

ACTIONS = {
    "T059": ("close", """### Measured & Remediated (closing)
**Real measurements (local stack, profile documented):** `evidence/PERFORMANCE_REPORT.md`
- **LCP 1656 ms** (budget ≤2500) — 390×844 @2x, CPU 4× throttle, slow-4G 1.6/0.75 Mbps 150ms RTT via CDP
- **INP 41 ms** (budget ≤200) — input→next-paint on a same-page control under the same throttle profile
- **CLS 0.0000** (budget ≤0.1) — after remediation
- **API p95 175 ms at 50 concurrent sessions** (budget <500), 552 req/s, 0 errors — `scripts/api-latency-bench.ts`, raw `evidence/perf-api-latency.json`
- **Bundle 99.87 KB gzip JS** (budget 250 KB)
**Remediation performed during measurement:** CLS was 0.167 (loading one-liner collapsed into the loaded lesson card); replaced with a space-reserving skeleton (`child-home.tsx`) → CLS 0. Verified by `tests/e2e/perf-budget.spec.ts` (asserts budgets, writes `evidence/perf-web-vitals.json`).
**Honest gap:** production-CDN measurements + media latency re-run on real infra post-D09 (recorded in the report)."""),
    "T060": ("close", """### Automated & CI-Enforced (closing)
`tests/security/leak-scans.test.ts` (runs in `test:security`, CI builds the bundle **before** scanning — workflow reordered):
- no tracker/ad/analytics/session-replay SDK references (GA/GTM, Segment, Mixpanel, Hotjar, Clarity, FullStory, LogRocket, DoubleClick, FB SDK)
- no `getUserMedia`/`MediaRecorder`/speech-capture APIs anywhere
- no secrets under `VITE_` namespace
- no `target="_blank"` external links in child-facing surfaces
- no `correct_option_id`/`correctOptionId` in web source **or the built bundle**
Current run: **15/15 security tests pass** (8 isolation + 7 scans). Answer-key omission from API responses is additionally asserted in `tests/api/e2e-slice.test.ts`. Dependency CVE scanning (osv/audit) remains a nice-to-have on top; the acceptance criteria's leak/abuse checks are enforced."""),
    "T062": ("close", """### Drill Executed With Resurrection Proof (closing)
`scripts/restore-drill.sh` + `packages/database/src/verify-restore.ts` — repeatable, measured drill (`evidence/restore-drill-20260905-155716.md`):
1. sacrificial child created → 2. backup taken (child inside) → 3. child deleted on live (ledger row written) → 4. **pre-deletion backup restored into an isolated DB — profile resurrected (1)** → 5. live suppression ledger re-applied → 6. verifier **detected and re-deleted the resurrected profile; 0 remain**.
**Measured:** RTO 799 ms local (dump 330 + restore 417 + first verified read 52), RPO anchored to last pre-dump row; schema (34 tables), content pointers, session ownership, and event/child composite integrity all PASS on the restored copy.
**Scope note:** local-scale isolated drill on docker PostgreSQL 16; the production-scale drill (real infra, off-site copy) re-runs post-D09 — recorded in the evidence file."""),
    "T066": ("comment", """### Progress: responsive coverage complete; artwork licensing remains
- **320px and 1024px captures added** (full journey sets: `evidence/screenshots/w320-*.png`, `w1024-*.png`) — total 100 screenshots across 320/390/768/1024/1440. 320px verified: no horizontal overflow, greeting + CTA + bottom nav intact.
- All previously-missing screen states (onboarding, gate, ayah player, privacy surfaces, admin) are implemented as real components and captured.
- **Still open (external):** licensed/original production artwork with rights evidence (current visuals are token-styled placeholders, no mockup slicing), plus device-lab (iOS Safari / Android Chrome) review. Keeping open for the rights decision (D12)."""),
    "T068": ("comment", """### Dependency update
T059 (performance), T060 (leak scans), T062 (restore drill) are now closed with evidence. Remaining open dependency: **T067 supervised usability pilot** (and the approval gates T063–T065). Automated regression matrix is green: typecheck, 9+7+10+15 tests, build 99.87 KB gzip, 17 browser tests. Staying open until pilot defects are resolved."""),
}

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)

def main():
    import json
    issues = json.loads(sh("gh", "issue", "list", "-R", REPO, "--state", "open", "--limit", "100", "--json", "number,title").stdout or "[]")
    for issue in issues:
        num, tid = issue["number"], issue["title"].split(" ")[0]
        if tid in ACTIONS:
            action, body = ACTIONS[tid]
            sh("gh", "issue", "comment", str(num), "-R", REPO, "-b", body)
            if action == "close":
                sh("gh", "issue", "close", str(num), "-R", REPO, "-r", "completed")
            print(f"{action}d {tid} (#{num})")
            time.sleep(0.5)

if __name__ == "__main__":
    main()
