#!/usr/bin/env python3
"""Update and close completed M0 and M1 GitHub issues with evidence."""
import subprocess
import time

REPO = "ther12k/rz-quran"

M0_M1_EVIDENCE = {
    "T001": """### Implemented & Tested Evidence
- **Repository assessment doc**: `docs/m0/01_REPO_ASSESSMENT.md`
- **Boundary identification**: Zero modifications to adjacent projects (`aifiqh-new`, ports 5434/9000/4011 preserved).
- **Dedicated repository**: Initialized at `ther12k/rz-quran` with clean separation.""",

    "T002": """### Implemented & Tested Evidence
- **Runtime compatibility doc**: `docs/m0/02_RUNTIME_COMPATIBILITY.md`
- **Pinned versions in lockfile**: Bun 1.4.0, Elysia 1.4.30, Better Auth 1.7.2, Drizzle ORM 0.44.7, Drizzle Kit 0.31.10, PostgreSQL 16, React 19.1.0, Vite 7.1.9, Tailwind CSS 4.1.13, Zod 3.25.76, Vitest 3.x.
- **Lockfile committed**: `bun.lock`.""",

    "T003": """### Implemented & Tested Evidence
- **Decision register**: `docs/m0/03_ELIGIBILITY_CONSENT_DECISIONS.md`
- **Fail-closed production gates**: Implemented in `apps/api/src/env.ts` and verified in `tests/unit/env.test.ts`. Real child enrollment blocked in production until legal policy sign-off.""",

    "T004": """### Implemented & Tested Evidence
- **Content dependency inventory**: `docs/m0/04_CONTENT_DEPENDENCY_INVENTORY.md`
- **Candidate sources documented**: Tanzil, approved recitation, studio Hijaiyah recording, Kemenag translation, production vector art.
- **Role separation**: `content_editor` vs distinct `content_reviewer` specified in `staff_members` table.""",

    "T005": """### Implemented & Tested Evidence
- **Design tokens**: Defined in `apps/web/src/styles.css` (primary `#157f43`, ink `#17312b`, page `#fbfcf7`, border `#dee8dd`, pastels).
- **Accessible UI primitives**: `apps/web/src/components/ui.tsx` with 48px minimum touch targets, visible focus outlines (`:focus-visible`), and reduced-motion support.
- **Arabic typography**: RTL isolated, line-height 1.9, no letter spacing.""",

    "T006": """### Implemented & Tested Evidence
- **Workspace scripts**: Defined in `package.json` (`dev`, `build`, `lint`, `typecheck`, `test:unit`, `test:contracts`, `test:integration`, `test:security`, `test:e2e`, `db:migrate`, `db:seed:demo`, `check:production-readiness`).
- **CI workflow**: `.github/workflows/ci.yml` running postgres:16 service, typecheck, contracts, unit, migrations, integration, security, web build, and fail-closed readiness test.""",

    "T007": """### Implemented & Tested Evidence
- **DTO & Authoring contracts**: `packages/contracts/src/dto.ts` and `authoring.ts` mirroring OpenAPI 3.1.
- **Schema verification tests**: `tests/contracts/examples.test.ts` (all 9 contract tests passing, validating bundled positive and negative examples).""",

    "T008": """### Implemented & Tested Evidence
- **Checked database migrations**: `packages/database/migrations/0000_nappy_karnak.sql` and `0001_moaning_rafael_vega.sql` applied on PostgreSQL 16.
- **Invariants enforced**: Composite foreign keys, 32 CHECK constraints, and partial unique index `one_writable_session_per_child`.""",

    "T009": """### Implemented & Tested Evidence
- **Guarded demo seed**: `packages/database/src/seed-demo.ts` seeds non-production Hijaiyah letter lesson.
- **Safety switches**: Refuses `APP_ENV=production` or `staging`, refuses `DEMO_MODE=false`. Verified with automated test runs.""",

    "T010": """### Implemented & Tested Evidence
- **Threat model document**: `docs/m0/05_THREAT_BOUNDARIES_AND_SECURITY.md`
- **Negative tests**: `tests/security/isolation.test.ts` covering 8 attack vectors (ID substitution, child-mode gate bypass, replay, race conditions).""",

    "T011": """### Implemented & Tested Evidence
- **Adult auth integration**: Better Auth 1.7.2 with PostgreSQL Drizzle adapter in `apps/api/src/auth.ts`.
- **Credential security**: Scrypt password hashing via `better-auth/crypto`, HTTP-only secure session cookies, same-origin proxy.""",

    "T012": """### Implemented & Tested Evidence
- **Email verification & recovery**: Required before child profile creation (`email_verified == true`).
- **Stateless token flow**: Tested end-to-end; unverified accounts blocked from creating children.""",

    "T013": """### Implemented & Tested Evidence
- **Server-enforced parent gate**: 5-minute adult gate (`adult_gate_until`) requiring password reauthentication.
- **Bidirectional transition**: Unlocking gate sets `mode=parent`; entering child mode clears gate atomically (`adult_gate_until = NULL`). Tested in integration and E2E.""",

    "T014": """### Implemented & Tested Evidence
- **Child-mode auth allowlist**: In `apps/api/src/modules/identity.ts`, only safe read/logout routes permitted in child mode.
- **Bypass prevention**: `update-user` and `change-password` return 403 `PARENT_GATE_REQUIRED` in child mode (verified in `tests/security/isolation.test.ts`).""",

    "T015": """### Implemented & Tested Evidence
- **Consent state machine**: `apps/api/src/modules/families.ts` records versioned family/child consents.
- **Assurance enforcement**: Demo assurance token valid in local/test only; production fails closed with `ELIGIBILITY_BLOCKED`.""",

    "T016": """### Implemented & Tested Evidence
- **Child profiles**: Nickname (1–30 chars), curated avatar key, age band (`5_7`, `8_10`).
- **Race-safe 3-profile limit**: Protected by PostgreSQL row lock `SELECT id FROM parents WHERE id = $1 FOR UPDATE`. 4th profile rejected (tested in `tests/security/isolation.test.ts`).""",

    "T017": """### Implemented & Tested Evidence
- **Mode switching**: `POST /api/v1/parent/children/:id/enter` switches to `mode=child`, selects active child, and clears gate in a single transaction.
- **Context propagation**: `/api/v1/me` reflects child nickname and active child id.""",

    "T018": """### Implemented & Tested Evidence
- **Scoped repository queries**: Every private lookup enforces `WHERE parent_id = ctx.parent.id`.
- **Isolation tests**: Cross-parent read, update, enter, and progress queries return 404 (tested in `tests/security/isolation.test.ts`).""",

    "T019": """### Implemented & Tested Evidence
- **Safe public serialization**: `PublicLesson` and `LearningSession` DTOs verified to omit `correct_option_id`, explanations, and private notes. Tested in `tests/api/e2e-slice.test.ts`.""",

    "T020": """### Implemented & Tested Evidence
- **Pinned learning sessions**: Sessions pin immutable lesson version ID.
- **One-session constraint**: Concurrent/second session for another lesson returns 409 `SESSION_IN_USE`; resuming same lesson returns active session. Tested in `tests/security/isolation.test.ts`.""",

    "T021": """### Implemented & Tested Evidence
- **Ordered idempotent events**: Validates contiguous sequence numbers; replays reuse stored results; sequence gaps return 409 `EVENT_SEQUENCE_CONFLICT` with `last_accepted_sequence`. Tested in `tests/api/e2e-slice.test.ts`.""",

    "T022": """### Implemented & Tested Evidence
- **Session completion**: Requires all required units to be completed before finish is allowed.
- **First-completion reward**: Exactly one star awarded via `rewards` table unique constraint (`child_id, lesson_id, reward_type`). Replay finish returns completion without duplicate stars. Tested in `tests/api/e2e-slice.test.ts`.""",

    "T023": """### Implemented & Tested Evidence
- **Child Home & Activity UI**: Built responsive components in `apps/web/src/pages/child-home.tsx` and `lesson-player.tsx`.
- **Honest empty & missing states**: Rendered honest audio-unavailable banner ("Audio belum tersedia... Suaramu tidak direkam").
- **Screenshots captured**: Verified at 390px, 768px, and 1440px viewports (`evidence/screenshots/w*-07-child-home.png`, `w*-08-lesson-step-instruction.png`, `w*-09-lesson-step-letter.png`).""",

    "T024": """### Implemented & Tested Evidence
- **Parent progress slice**: Built `apps/web/src/pages/parent-progress.tsx` with real aggregates, denominators (0/1 lessons completed, 0/3 units), first-answer accuracy, and active practice time.
- **Accessible weekly activity**: Bar chart visual plus accessible data table alternative.
- **Screenshots captured**: Verified at 390px, 768px, and 1440px viewports (`evidence/screenshots/w*-13-parent-progress.png`).""",

    "T025": """### Implemented & Tested Evidence
- **Automated integration test**: `tests/api/e2e-slice.test.ts` exercises full adult onboarding → gate → child profile → lesson session → finish & star → parent report on disposable PostgreSQL.
- **Playwright visual test**: `tests/e2e/m1-journey.spec.ts` passes across all 3 viewports (`mobile-390`, `tablet-768`, `desktop-1440`).
- **All 26 automated backend tests pass**: 9 contract + 7 unit + 2 integration + 8 security.""",
}

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)

def main():
    import json
    issues = json.loads(sh("gh", "issue", "list", "-R", REPO, "--state", "open", "--limit", "100", "--json", "number,title").stdout or "[]")
    
    for issue in issues:
        num = issue["number"]
        title = issue["title"]
        tid = title.split(" ")[0]
        if tid in M0_M1_EVIDENCE:
            comment = M0_M1_EVIDENCE[tid]
            print(f"Closing {tid} (#{num})...")
            sh("gh", "issue", "comment", str(num), "-R", REPO, "-b", comment)
            sh("gh", "issue", "close", str(num), "-R", REPO, "-r", "completed")
            time.sleep(0.5)

    print("Completed M0 & M1 issue updates.")

if __name__ == "__main__":
    main()
