#!/usr/bin/env python3
"""Import tasks/BACKLOG.md into GitHub issues (ther12k/rz-quran).

One issue per backlog task, preserving task IDs, with milestones M0-M5 and
labels P0 / in-progress / blocked-approvals. Adds an honest "Repo state" line
for tasks with implementation already in the repository. Idempotent: skips
task IDs whose issue already exists (matched by title prefix).
"""
import json
import re
import subprocess
import sys
import time

REPO = "ther12k/rz-quran"
BACKLOG = "tasks/BACKLOG.md"

REPO_STATE = {
    "T001": "Repository assessed as empty/greenfield inside an unrelated outer repo; handoff v1.0 imported without touching other work. Written assessment doc still pending.",
    "T002": "Lockfile committed and verified locally: bun 1.4.0, better-auth 1.7.2, elysia 1.4.30, drizzle-orm 0.44.7, drizzle-kit 0.31.10, postgres.js 3.4.9, react 19.1, vite 7.1, tailwindcss 4.1, zod 3.25.76, vitest 3. Written compatibility record still pending.",
    "T003": "Owners not yet assigned; production enrollment stays blocked by fail-closed env gates (implemented + unit tested in apps/api/src/env.ts).",
    "T004": "Inventory pending; demo fixtures contain letters only, no audio/Qur'an text (packages/database/src/seed-demo.ts).",
    "T005": "Tokens + accessible primitives implemented in apps/web (styles.css, components/ui.tsx): 48px targets, focus rings, reduced-motion, Arabic typography rules. Contrast measurements still pending.",
    "T006": "Workspace scripts (dev/build/test:*/db:*/check:production-readiness) implemented; CI workflow NOT yet created.",
    "T007": "Zod DTO + authoring schemas implemented in packages/contracts; bundled positive examples pass and invalid examples fail (9 contract tests). OpenAPI drift checks still pending.",
    "T008": "Drizzle migrations 0000/0001 generated and applied on PostgreSQL 16 (dev DB + disposable per-test DBs); one-writable-session partial index, composite FKs and CHECKs included; ownership/completion uniqueness covered by tests. Broader concurrent-write suite still pending.",
    "T009": "Guarded demo seed implemented; refusals verified for APP_ENV=production/staging and DEMO_MODE=false; production boot also refuses demo mode (unit tested).",
    "T010": "Negative tests implemented for ownership, child-mode auth bypass, gate expiry, replay/idempotency (8 security tests). Written threat-model doc still pending.",
    "T011": "Better Auth 1.7.2 integrated (drizzle adapter, email+password, requireEmailVerification); sign-up/verify/sign-in verified against a real DB; SMTP adapter wiring pending (local stub logs the verification link).",
    "T012": "Unverified accounts cannot create children (tested); verification links issue and expire via the library; resend-limit UI states pending.",
    "T013": "5-minute server gate implemented incl. unlock from child mode (sets mode=parent) and gate clearing on child entry; expiry returns PARENT_GATE_REQUIRED (tested). Attempt rate limiting pending.",
    "T014": "Child-mode allowlist around mounted auth routes implemented; update-user/change-password blocked in child mode while get-session/sign-out still work (tested).",
    "T015": "Consent state machine implemented: demo assurance local/test only; production fails closed with ELIGIBILITY_BLOCKED; versioned notice/policy recorded (tested).",
    "T016": "Profiles implemented with race-safe 3-active limit (parent row lock) and owner-scoped CRUD; fourth profile rejected (tested).",
    "T017": "Enter-child-mode implemented atomically (mode=child, active child, gate=NULL); /me reflects state (tested).",
    "T018": "Cross-parent read/enter/report/patch all return 404 (tested); queries stay owner-scoped via context objects.",
    "T019": "Public lesson/session DTOs verified to omit correct_option_id, options and explanations (tested).",
    "T020": "Sessions pin the published version; starting the same lesson again returns the same session (tested). Explicit parent-gated replace flow pending.",
    "T021": "Ordered idempotent event batches implemented: contiguous sequences, identical retries reuse stored results, gaps return EVENT_SEQUENCE_CONFLICT with the last accepted sequence (tested).",
    "T022": "Finish requires all required units; replay returns completion without a second star; unique reward row enforced (tested).",
    "T023": "Child home + lesson player implemented (apps/web) with the honest audio-unavailable state, progress fraction, server-scored quiz step and a calm break affordance. Responsive/a11y verification and screenshots pending.",
    "T024": "Gated parent progress page implemented reading real scoped aggregates with denominators, weekly chart + table alternative and honest zero states.",
    "T025": "Automated E2E + security suites run against a real local PostgreSQL (2 integration + 8 security tests, passing). Browser-level run and Playwright capture pending.",
}
APPROVAL_BLOCKED = {"T063", "T064", "T065", "T066", "T067", "T070"}


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)


def parse_backlog():
    text = open(BACKLOG, encoding="utf-8").read()
    tasks = []
    for block in re.split(r"^(?=### T\d+)", text, flags=re.M):
        m = re.match(r"### (T\d+) — (.+)", block)
        if not m:
            continue
        tid, title = m.group(1), m.group(2).strip()
        pos = text.find(block)
        milestones = re.findall(r"^## (M\d+)$", text[:pos], flags=re.M)
        status = re.search(r"Status: \*\*(.+?)\*\*", block)
        priority = re.search(r"Priority: (\S+)", block)
        owner = re.search(r"Owner: (.+?)\s*·\s*Effort", block)
        effort = re.search(r"Effort: (\S+)", block)
        reqs = re.search(r"Requirements: (.+?)\.\s*Dependencies: (.+?)\.", block, flags=re.S)
        req_line = re.search(r"Requirements: (.+)", block)
        criteria: list[str] = []
        if "Acceptance criteria:" in block:
            segment = block.split("Acceptance criteria:")[1]
            if "Evidence to attach:" in segment:
                segment = segment.split("Evidence to attach:")[0]
            criteria = re.findall(r"^- (.+)$", segment, flags=re.M)
        evidence = re.search(r"Evidence to attach: (.+)", block)
        tasks.append(
            {
                "id": tid,
                "title": title,
                "milestone": milestones[-1] if milestones else "M0",
                "status": status.group(1) if status else "todo",
                "priority": priority.group(1) if priority else "P0",
                "owner": owner.group(1).strip() if owner else "—",
                "effort": effort.group(1) if effort else "—",
                "requirements": reqs.group(1).strip() if reqs else (req_line.group(1).strip() if req_line else "—"),
                "dependencies": reqs.group(2).strip() if reqs else "none",
                "criteria": criteria,
                "evidence": evidence.group(1).strip() if evidence else "—",
            }
        )
    return tasks


def main():
    tasks = parse_backlog()
    print(f"Parsed {len(tasks)} tasks")
    if len(tasks) != 74:
        print("EXPECTED 74 TASKS — refusing to import a partial parse", file=sys.stderr)
        sys.exit(1)

    milestones = {}
    for ms in ["M0", "M1", "M2", "M3", "M4", "M5"]:
        milestone_desc = f"{ms} backlog milestone (tasks/BACKLOG.md)"
        out = sh("gh", "api", f"repos/{REPO}/milestones", "-f", f"title={ms}", "-f", f"description={milestone_desc}")
        number = None
        if out.returncode == 0:
            number = json.loads(out.stdout)["number"]
        else:
            # Idempotency: resolve by title from the live list.
            listed = json.loads(sh("gh", "api", f"repos/{REPO}/milestones").stdout or "[]")
            number = next((m["number"] for m in listed if m["title"] == ms), None)
        if number is not None:
            milestones[ms] = number
            print(f"milestone {ms} ok")
        time.sleep(0.4)
    if len(milestones) != 6:
        print("milestones incomplete; aborting", file=sys.stderr)
        sys.exit(1)

    for label, color, desc in [
        ("P0", "d73a4a", "Priority P0 (MVP required)"),
        ("blocked-approvals", "b60205", "Blocked on external human approval (content rights / curriculum / privacy)"),
        ("in-progress", "fbca04", "Implementation started in this repository"),
    ]:
        out = sh("gh", "api", f"repos/{REPO}/labels", "-f", f"name={label}", "-f", f"color={color}", "-f", f"description={desc}")
        if out.returncode != 0 and "already_exists" not in out.stderr:
            print(f"label {label} FAILED: {out.stderr.strip()[:200]}", file=sys.stderr)
        time.sleep(0.4)

    existing = json.loads(sh("gh", "issue", "list", "-R", REPO, "--state", "all", "--limit", "400", "--json", "title").stdout or "[]")
    existing_ids = {t["title"].split(" ")[0] for t in existing}

    created = skipped = failed = 0
    for t in tasks:
        if t["id"] in existing_ids:
            skipped += 1
            continue
        labels = ["P0"]
        if t["id"] in REPO_STATE:
            labels.append("in-progress")
        if t["id"] in APPROVAL_BLOCKED:
            labels.append("blocked-approvals")

        body = [f"> Imported from `{BACKLOG}` (RZ-Quran-Kids-Handoff-v1.0) on 2026-09-05. Task IDs preserved.", ""]
        body.append(f"**Status:** {t['status']} · **Priority:** {t['priority']} · **Owner:** {t['owner']} · **Effort:** {t['effort']}")
        body.append(f"**Requirements:** {t['requirements']}")
        body.append(f"**Dependencies:** {t['dependencies']}")
        body.append("")
        repo_state = REPO_STATE.get(t["id"])
        if repo_state:
            body.append(f"**Repo state (2026-09-05):** {repo_state}")
            body.append("")
        body.append("## Acceptance criteria")
        for c in t["criteria"]:
            body.append(f"- {c}")
        body.append("")
        body.append(f"*Evidence to attach:* {t['evidence']}")
        with open("/tmp/rzq-issue-body.md", "w", encoding="utf-8") as f:
            f.write("\n".join(body))

        args = ["gh", "issue", "create", "-R", REPO, "-t", f"{t['id']} · {t['title']}", "-F", "/tmp/rzq-issue-body.md"]
        for label in labels:
            args += ["-l", label]
        args += ["-m", t["milestone"]]
        out = sh(*args)
        if out.returncode == 0:
            created += 1
            print(f"{t['id']} -> {out.stdout.strip()}")
        else:
            failed += 1
            print(f"{t['id']} FAILED: {out.stderr.strip()[:200]}", file=sys.stderr)
        time.sleep(0.7)

    print(f"\ncreated={created} skipped={skipped} failed={failed} total={len(tasks)}")


if __name__ == "__main__":
    main()
