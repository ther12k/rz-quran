#!/usr/bin/env python3
"""Update and close completed M3 GitHub issues with evidence."""
import subprocess
import time

REPO = "ther12k/rz-quran"

M3_EVIDENCE = {
    "T041": """### Implemented & Tested Evidence
- **Provisioned staff capabilities**: `staff_members` table with `content_editor`, `content_reviewer`, `content_publisher`, `ops_admin` capability arrays; `requireStaffCapability()` gate in `apps/api/src/modules/admin.ts`.
- **Registry endpoints**: `GET/POST /api/v1/admin/sources`, `PATCH /api/v1/admin/sources/:id/rights` (reviewer-recorded rights decisions: pending/approved/denied/revoked).
- **Test**: `tests/api/m3-editorial-workflow.test.ts` — editor registers source, distinct reviewer approves rights. Verified.""",

    "T042": """### Implemented & Tested Evidence
- **Quarantine ingestion**: `POST /api/v1/admin/assets` creates assets in `status='quarantine'` with checksum (SHA-256), MIME, byte size, duration; delivery never served to children until verified.
- **Test**: Verified in `tests/api/m3-editorial-workflow.test.ts` (asset created with `status=quarantine`).""",

    "T043": """### Implemented & Tested Evidence
- **Background worker**: `apps/api/src/jobs/worker.ts` — PostgreSQL-backed job loop with row-level lease (`FOR UPDATE SKIP LOCKED`), retry attempts, and idempotent handlers.
- **Asset verification job**: `asset_verify` job transitions assets quarantine → verified.
- **Test**: Worker processes queued job and asset status becomes `verified`. Verified in M3 test suite.""",

    "T044": """### Implemented & Tested Evidence
- **Structured draft creation**: `POST /api/v1/admin/lessons/drafts` validates the full authoring payload via `authoringLessonSchema` (unique ordinals, letter/ayah unit shape rules, 2–4 options, exactly one correct option among options, choice units require a question).
- **Draft preview & versioning**: Version numbers increment; drafts never touch the published pointer until publish.""",

    "T045": """### Implemented & Tested Evidence
- **Submit for review**: `POST /admin/lessons/drafts/:id/submit` transitions draft → in_review.
- **Second-person review invariant**: `POST /admin/lessons/drafts/:id/reviews` rejects self-review (reviewer must differ from author; denial audited) and records an immutable `content_reviews` row against the release hash.
- **Publish**: `POST /admin/lessons/drafts/:id/publish` requires approved status + moves the immutable published pointer transactionally.
- **Test**: Self-review denial + distinct-reviewer approval + publish verified in `tests/api/m3-editorial-workflow.test.ts`.""",

    "T046": """### Implemented & Tested Evidence
- **Deterministic release hashing**: `packages/contracts/src/release-hash.ts` — canonical JSON serialization (sorted keys, recursive) + SHA-256. Same payload always yields identical hash; changes after review produce a new hash requiring re-review.
- **Test**: `computeReleaseHash` verified deterministic and 64-hex-char in `tests/api/m3-editorial-workflow.test.ts`.""",

    "T047": """### Implemented & Tested Evidence
- **Emergency recall**: `POST /api/v1/admin/lessons/:lessonId/recall` — transactionally sets version `status='recalled'` AND invalidates all active/paused child sessions pinned to that version (`status='recalled'`).
- **Safe learner path**: In-flight session writes receive 410 `CONTENT_RECALLED`; child UI shows calm "Materi sedang diperiksa" state.
- **Test**: Verified end-to-end in M3 test suite (recall → active session write → 410 CONTENT_RECALLED).""",

    "T048": """### Implemented & Tested Evidence
- **Parent content reports**: `POST /api/v1/parent/content-reports` with reason enum (`wrong_text`, `wrong_audio`, `unclear_instruction`, `other`), optional bounded note, private triage status (`new`/`triaged`/`resolved`), owner-gated.
- **Test**: Verified in `tests/api/m3-editorial-workflow.test.ts`.""",

    "T049": """### Implemented & Tested Evidence
- **Curriculum DAG release**: `curriculum_releases` table with structured JSON definition (3-stage DAG), `review_evidence`, and `release_hash` computed over the definition; published pilot curriculum seeded in `packages/database/src/seed-pilot.ts`.
- **Prerequisite enforcement**: Catalog stage locks derive from the released graph (M2 test verifies lock→unlock lifecycle).""",

    "T050": """### Implemented & Tested Evidence
- **Redacted audit trail**: `audit_events` table capturing actor, action, object, outcome, request_id, timestamp; no child data or secrets in metadata.
- **Viewer**: `GET /api/v1/admin/audit-events` (ops_admin capability) + admin workspace Audit tab UI.
- **Test**: Actions (`register_source`, `upload_asset`, `publish_lesson`, `recall_lesson`) verified present in audit log in M3 test suite.""",

    "T051": """### Implemented & Tested Evidence
- **Admin workspace UI**: `apps/web/src/pages/admin.tsx` — 5 tabs (Draft & Review Dua Orang, Sumber & Hak Cipta, Karantina Aset, Penarikan Seketika, Jejak Audit) with staff-capability badge, Indonesian copy, and demo banner.
- **Responsive screenshots captured** at 390px, 768px, 1440px: `evidence/screenshots/w*-m3-01..05-*.png`.""",
}

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)

def main():
    import json
    issues = json.loads(sh("gh", "issue", "list", "-R", REPO, "--state", "open", "--limit", "100", "--json", "number,title").stdout or "[]")

    closed = 0
    for issue in issues:
        num = issue["number"]
        tid = issue["title"].split(" ")[0]
        if tid in M3_EVIDENCE:
            print(f"Closing {tid} (#{num})...")
            sh("gh", "issue", "comment", str(num), "-R", REPO, "-b", M3_EVIDENCE[tid])
            sh("gh", "issue", "close", str(num), "-R", REPO, "-r", "completed")
            closed += 1
            time.sleep(0.5)

    print(f"Closed {closed} M3 issues.")

if __name__ == "__main__":
    main()
