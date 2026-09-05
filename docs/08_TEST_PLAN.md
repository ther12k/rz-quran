# Test Plan & Acceptance Evidence

The following are **planned application tests**, not tests executed while writing this package. See `qa/PACKAGE_VALIDATION.md` for checks that were actually performed on the handoff artifacts. Automated results, manual Arabic/accessibility review and external approvals must be recorded separately.

## Test environments and data

Unit tests use synthetic values. Integration tests use real disposable PostgreSQL with actual migrations, two unrelated parents, at least three child profiles, multiple immutable content versions and approved/recalled fixture states. Production cannot accept fixture approvals. Browser tests use the supported versions selected during M0, with explicit iOS Safari/Android Chrome manual playback checks.

Run owner/gate/serialization/idempotency tests before expanding UI. A mocked repository is not sufficient for constraints, transaction or race tests. Never put real child data or unlicensed corpus/audio into CI fixtures.

## Test cases

### QA001 — Adult verification

Requirements: FR-01.

Method: Create unverified adult, attempt child creation, verify email, retry required policy steps.

Expected: No child before verification/eligibility; valid recovery and safe expiry states.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA002 — Cross-parent isolation

Requirements: FR-02.

Method: With two parents and three child IDs, substitute IDs in every child read/write/report/export/select route.

Expected: No cross-parent data or mutations; consistent not-found/denial without existence leak.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA003 — Concurrent child limit

Requirements: FR-02.

Method: Submit simultaneous profile-create requests while parent already has two children.

Expected: At most one new active child commits; final count never exceeds three.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA004 — Server parent gate

Requirements: FR-03.

Method: Enter child mode; call parent endpoints directly, use history/back and reuse an expired gate.

Expected: Parent data/mutations denied; caches cleared; fresh reauthentication required.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA005 — Auth-handler bypass

Requirements: FR-01, FR-03.

Method: Attempt library account/email/session management endpoints in child mode.

Expected: Reviewed allowlist enforced; no hidden-route privilege bypass.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA006 — Consent and production eligibility

Requirements: FR-01, FR-15.

Method: Try unconfigured policy, fixture assurance in production and later family/child withdrawal.

Expected: Production fail-closed; writes stop immediately for withdrawn scope.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA007 — Home and landing states

Requirements: FR-04.

Method: Render landing and first-time/resumed/complete/no-content child home at 320 and 390 widths.

Expected: Eight benefits on landing; one clear child action; no fake scores or horizontal overflow.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA008 — Catalog visibility

Requirements: FR-05.

Method: Search/filter catalog containing draft, reviewed, published, retired and recalled versions.

Expected: Only entitled published results appear; no key/internal data leaks; useful empty state.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA009 — Prerequisite graph

Requirements: FR-05.

Method: Publish cyclic/broken curriculum and navigate locked/withdrawn prerequisites.

Expected: Invalid graph rejected; child has a valid path; parent override is audited without completion reward.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA010 — Audio lifecycle

Requirements: FR-06.

Method: Rapidly play/pause, switch routes/profiles during buffering, then trigger old ended event.

Expected: One audio controller; no stale playback or incorrect lesson advancement.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA011 — Media failures

Requirements: FR-06.

Method: Return 403/expired URL/503/bad MIME/range interruption and test replay.

Expected: Safe retry/unavailable messages; no microphone or synthetic recitation fallback.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA012 — Canonical source integrity

Requirements: FR-07, FR-13.

Method: Alter a verse byte, swap source IDs, change verse metadata count or mismatch audio segment.

Expected: Automated checks block invalid mappings; human review evidence is required for publish.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA013 — Arabic manual rendering

Requirements: FR-07, FR-17.

Method: Inspect approved marked Arabic at 320 px and 200% zoom in mobile Safari/Chrome and desktop browsers.

Expected: No clipping/reversal/unwanted translation; references and basmala follow approved edition.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA014 — Practice versus memorization

Requirements: FR-07, FR-11.

Method: Complete all ayah units without a parent observation, then add/change a parent observation.

Expected: Practice reaches full fraction without automatic fluency claim; separate parent-labeled history exists.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA015 — Question DTO leakage

Requirements: FR-08, FR-09.

Method: Inspect network JSON, DOM, cache and built bundle before answering.

Expected: No correct-option field or server key is shipped; options are valid public labels only.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA016 — First answer and retries

Requirements: FR-08, FR-09.

Method: Submit wrong first answer, correct retry, duplicate IDs and option from another question/session.

Expected: First accuracy remains wrong; retries support practice; invalid memberships rejected.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA017 — Quiz usability

Requirements: FR-08.

Method: Complete five questions by keyboard/touch including error/retry/no answer state.

Expected: Visible feedback and navigation; no timer pressure; zero data not treated as failure.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA018 — Game input parity

Requirements: FR-09.

Method: Complete sound game with single taps and keyboard, never dragging.

Expected: Same outcome as optional drag; selected state not color-only; summary is separate from active board.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA019 — Atomic event batches

Requirements: FR-10.

Method: Send 20 valid events, one malformed/ineligible event within a batch, and same IDs after timeout.

Expected: All new valid batch events commit once; invalid batch changes none; replay returns stored result.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA020 — Sequence conflicts

Requirements: FR-10.

Method: Race heartbeat/answer, skip sequence and reuse ID with different payload.

Expected: Conflict errors expose safe last sequence; no silent reordering/double increments.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA021 — Concurrent finish and stars

Requirements: FR-10.

Method: Finish the same session in parallel and complete another version of the same logical lesson.

Expected: One completion result per session and one logical-lesson first star per child.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA022 — Resume and replacement

Requirements: FR-10.

Method: Pause/resume under 24h, expire session, replace via parent gate then send old events.

Expected: Accepted history preserved; expired/replaced sessions cannot write into new state.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA023 — Active time estimation

Requirements: FR-10, FR-11.

Method: Send duplicate/large/negative heartbeats, background tab gaps and simultaneous sessions.

Expected: Bounded server-capped time only; no wall-clock idle or multi-tab double count.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA024 — Reports and denominators

Requirements: FR-11.

Method: Use mixed question counts, no answers, several local dates and a timezone change.

Expected: Weighted first-response accuracy and consistent local buckets; no divide-by-zero or fake totals.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA025 — Comfort settings

Requirements: FR-12.

Method: Set quiet/reduced-motion/goal settings then change child and reach goal.

Expected: Scope correct; requested lesson audio still works; break is gentle, not punitive.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA026 — Staff roles and MFA

Requirements: FR-13.

Method: Try every admin action as child, parent, wrong staff role and non-MFA staff session.

Expected: Least privilege and MFA enforced; no family impersonation or self-escalation.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA027 — Publication separation

Requirements: FR-13.

Method: Self-approve, modify approved payload, publish missing rights/audio and republish concurrently.

Expected: All invalid publication paths rejected; version hash/review relation remains immutable.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA028 — Import/upload security

Requirements: FR-13.

Method: Use oversized file, fake MIME, malformed JSON, arbitrary URL and redirect to private host.

Expected: Quarantine and allowlist checks stop delivery/fetch; errors do not leak credentials.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA029 — Recall propagation

Requirements: FR-14.

Method: Recall a version during active lesson, request fresh playback and start another session.

Expected: No new entitlement; active session stops on next check; history remains and safe alternative offered.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA030 — Private parent reports

Requirements: FR-14.

Method: Submit content report without gate and with another family’s object; inspect staff/audit output.

Expected: Only authorized reports accepted; notes private and excluded from ordinary logs.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA031 — Private data export

Requirements: FR-15.

Method: Export parent A, fetch job/link as B, expire link and inspect JSON fields.

Expected: Only A data; no secrets/keys; private expiring download; expected schema notes.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA032 — Deletion lifecycle

Requirements: FR-15.

Method: Delete profile/account, retry job and inspect DB/storage/caches; restore old backup.

Expected: Immediate revocation, safe repeated deletion and suppression after restore.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA033 — Offline boundaries

Requirements: FR-16.

Method: Cold offline open, drop network during loaded session, fill queue and reload.

Expected: Shell-only claim; unsaved progress clearly pending/lost on reload; no private service-worker cache.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA034 — Responsive layouts

Requirements: FR-17.

Method: Capture all primary child and representative parent/admin screens at 320/390/768/1024/1440.

Expected: Readable text, unobscured focus/buttons, real reflow; no whole-screen screenshot implementation.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA035 — Accessibility review

Requirements: FR-17.

Method: Keyboard, screen reader, contrast, 200% zoom, reduced motion, dialogs and chart table.

Expected: Manual issues resolved; scan results are not mislabeled as full accessibility certification.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA036 — Secret/PII/third-party audit

Requirements: FR-15, FR-18.

Method: Inspect bundle, network calls, log samples, job payloads and image fixtures.

Expected: No secrets, child tracking, mic/camera permission, raw passwords or unnecessary personal data.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA037 — HTTP security and limits

Requirements: FR-01, FR-03, FR-18.

Method: Cross-origin mutation, CSRF attack, oversized bodies and multi-replica rate-limit attempts.

Expected: Requests blocked appropriately with generic errors and safe Retry-After behavior.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA038 — Worker recovery

Requirements: FR-18.

Method: Kill worker mid-export/import/delete, let lease expire and rerun.

Expected: Idempotent effects, bounded retries, safe final job status and no duplicate external side effects.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA039 — Performance measurements

Requirements: FR-18.

Method: Run fixed mobile network/device profile and 50-active-session load scenario.

Expected: Report actual timings/budgets, bottlenecks and untested conditions; no fabricated benchmark pass.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA040 — Deploy and restore

Requirements: FR-18.

Method: Fresh local setup, staging migrate/smoke, app rollback and isolated database restore.

Expected: Documented scripts work; actual recovery measured; production flags and deletion replay verified.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA041 — Supervised pilot

Requirements: FR-04, FR-06, FR-08, FR-09, FR-11, FR-17.

Method: Run approved parent/child task protocol with qualified supervision and minimal data.

Expected: Record actual interventions and parent understanding; no unproven educational efficacy claim.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

### QA042 — Public launch gates

Requirements: FR-01, FR-13, FR-15, FR-18.

Method: Attempt release with missing source/legal/reviewer approval and with demo mode enabled.

Expected: Release blocked until named owners provide real evidence; agent cannot self-approve.

Evidence: attach command/log/screenshot or named human review; record actual pass/fail and environment.

## Definition of test completion

All P0 flows and negative authorization/publication paths have passing evidence; no critical/high security issue or critical content error is unresolved. Relevant browser/audio/Arabic/manual accessibility checks are signed by a responsible reviewer. Performance targets are either met with measured evidence or explicitly revised with approval. Human legal/content approvals cannot be simulated by test fixtures.

## Regression subsets

Every PR: lint/types/unit/contracts plus affected services. Database/auth/content/progress PR: disposable-DB integration and negative authorization tests. UI PR: affected Playwright flow and visual screenshots. Release candidate: entire matrix, dependency/secret checks, restore/recall/export/delete drills and approved supervised pilot results.

## Evidence record

Record test ID, commit, environment/runtime/browser, data fixture, exact method/command, result, artifact paths, reviewer and unresolved limitation. A skipped/unexecuted case is not a pass. Keep sensitive evidence out of public issue trackers.
