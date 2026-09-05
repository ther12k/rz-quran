#!/usr/bin/env python3
"""M5: comment status on all issues. T069 preflight tooling delivered;
T068 regression automated (pilot defects pending T067); approval-gated
issues (T063–T067, T070) get precise blocker documentation and stay open."""
import subprocess
import time

REPO = "ther12k/rz-quran"

COMMENTS = {
    "T063": """### Status: BLOCKED — external approval required (owner: Rights Owner)
**What exists today:** source registry with rights workflow (`pending/approved/denied/revoked`), reviewer separation, and license-reference fields (`content_sources`, M3) — plus a preflight gate `content.rights` that refuses publication on unapproved sources.
**What is still needed (cannot be produced by tooling):** signed permissions for (1) Qur'an canonical text distribution (Tanzil terms), (2) recitation recording/streaming rights, (3) Hijaiyah studio audio masters, (4) translations if used. Evidence must reference exact source releases.
This issue intentionally stays open. No fabricated approval.""",

    "T064": """### Status: BLOCKED — external approval required (owner: Qualified Content Reviewer, distinct from author)
**What exists today:** two-person review enforcement (self-review rejected, audited), immutable release hashes, review records (`content_reviews`), preflight gate `content.two_person_review` — all published versions currently have distinct reviewer + hash.
**What is still needed:** a named qualified reviewer's sign-off on text/audio mappings for the pilot curriculum, evidenced against exact release hashes. Demo/pilot seeds are not human-approved learning content.""",

    "T065": """### Status: BLOCKED — external approval required (owner: Privacy/Legal)
**What exists today:** fail-closed production gates (demo mode, enrollment policy versions, loopback DB, SMTP requirements — all machine-enforced in `env.ts` + preflight), versioned consent ledger, withdrawal enforcement (T052), export/deletion + suppression ledger (T053/T054).
**What is still needed:** the jurisdiction-specific assurance flow decision (Indonesian PDP 2026 framework review), retention schedule sign-off, and processor agreements. Until recorded, `PRODUCTION_CHILD_ENROLLMENT_ENABLED` stays false.""",

    "T066": """### Status: BLOCKED — external approval required (owner: Design + Rights Owner)
**What exists today:** all screens implemented as real responsive components (no screenshot slicing); missing-screen states (onboarding, gate, ayah player, privacy, admin) implemented and captured at 390/768/1440 in `evidence/screenshots/`; concept mockups never used as content assets.
**What is still needed:** licensed/original production artwork with rights evidence (current illustrations are placeholder typography/emoji-free styling), plus 320px/1024px captures and device-lab review.""",

    "T067": """### Status: BLOCKED — external activity required (owner: Product + Design + Privacy)
**What exists today:** the complete supervised-pilot-ready application (auth → gate → consent → profiles → learning → parent reports), a disposable-DB demo environment, and automated E2E journeys.
**What is still needed:** the approved participant/consent protocol and real supervised sessions with recorded task observations. Dependencies: T064 (approved curriculum) and T065 (approved consent policy) must clear first.""",

    "T068": """### Progress: automated regression matrix complete; pilot defects pending T067
**Regression evidence (2026-09-05, all green):**
- typecheck: api + web — 0 errors
- contracts: 9/9 · unit: 7/7 · integration: 10/10 · security: 8/8
- web build: 99.77 KB gzip JS (budget 250 KB)
- Playwright: 12/12 (M1 journey ×3 viewports, M3 admin ×3, a11y ×3, Arabic ×3)
- preflight: machine gates enforced, human gates itemized
Remaining: defect fixes from the supervised pilot (T067) and 320/1024px + device-lab passes. Staying open until then.""",

    "T069": """### Implemented & Tested Evidence
- **Preflight tool**: `apps/api/src/preflight.ts` (`bun run --filter @rzq/api preflight`) — aggregates machine gates (config fail-closed, demo-data absence, two-person review, source rights, current-version pointers, migrations) and lists human gates as PENDING-HUMAN; exits non-zero on any FAIL or pending human gate.
- **Verified run** (dev DB): correctly FAILS on demo-published lesson, loopback DB, missing SMTP, demo mode; PASSES content.rights/two_person_review/current_pointer/db.migrations; 8 human gates itemized.
**Honest boundary:** incident-contact drills and a real production deployment remain blocked on D09/T062. No external deployment was performed.""",

    "T070": """### Status: BLOCKED — explicit human release decision required
**What exists today:** every machine gate is enforced and every human gate is itemized by the preflight tool; nothing in the codebase can self-authorize deployment (`check:production-readiness` and `preflight` both fail closed).
**What is still needed:** recorded sign-offs from product, content, privacy, and engineering owners after T063–T067 and T069 complete. This issue is the final launch switch and intentionally stays open.""",
}

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)

def main():
    import json
    issues = json.loads(sh("gh", "issue", "list", "-R", REPO, "--state", "open", "--limit", "100", "--json", "number,title").stdout or "[]")
    n = 0
    for issue in issues:
        num, tid = issue["number"], issue["title"].split(" ")[0]
        if tid in COMMENTS:
            sh("gh", "issue", "comment", str(num), "-R", REPO, "-b", COMMENTS[tid])
            # T069 tooling is delivered: close only that one.
            if tid == "T069":
                sh("gh", "issue", "close", str(num), "-R", REPO, "-r", "completed")
                print(f"closed {tid} (#{num})")
            else:
                print(f"commented {tid} (#{num})")
            n += 1
            time.sleep(0.5)
    print(f"updated {n} M5 issues")

if __name__ == "__main__":
    main()
