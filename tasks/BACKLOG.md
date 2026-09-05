# Implementation Backlog

**74 P0 tasks. All are planned, not completed.** Preserve IDs when importing into an issue tool. M0–M5 are dependency gates; effort bands are relative and do not promise delivery dates. Requirement IDs refer to the PRD.

## M0

### T001 — Inspect repository and preserve existing work

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: S

Requirements: FR-18. Dependencies: none.

Acceptance criteria:
- Document current files, scripts, stack and unrelated changes.
- Identify the children’s app boundary; do not overwrite an existing Fiqh chatbot module.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T002 — Verify dependency and runtime compatibility

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-01, FR-18. Dependencies: T001.

Acceptance criteria:
- Record exact React/Vite/Bun/Elysia/auth/ORM versions actually tested.
- Build a minimal Vite frontend and Elysia/auth integration; commit a pinned lockfile.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T003 — Assign eligibility, consent and retention decisions

Status: **todo** · Priority: P0 · Owner: Product + privacy/legal · Effort: M

Requirements: FR-01, FR-02, FR-15. Dependencies: none.

Acceptance criteria:
- Assign owners for D02/D03/D09/D10 and list unresolved market/risk questions.
- Document that production child enrollment is blocked pending approved policy.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T004 — Inventory canonical text, audio and curriculum dependencies

Status: **todo** · Priority: P0 · Owner: Content + rights · Effort: M

Requirements: FR-06, FR-07, FR-13. Dependencies: none.

Acceptance criteria:
- List candidate source releases and missing rights evidence separately per asset type.
- Assign qualified content author/reviewer roles; do not assert approval.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T005 — Implement tokens and accessible UI primitives

Status: **todo** · Priority: P0 · Owner: Design + engineering · Effort: M

Requirements: FR-04, FR-17. Dependencies: T001.

Acceptance criteria:
- Translate design tokens into actual typography, spacing, focus and button components.
- Check intended color pairs and 48-pixel touch targets without using screenshot backgrounds.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T006 — Create workspace scripts and CI

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-18. Dependencies: T002.

Acceptance criteria:
- Provide lint, typecheck, unit, integration, E2E, contract and build scripts.
- CI installs the lockfile reproducibly and runs against a disposable database.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T007 — Integrate schemas and public DTO contracts

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-08, FR-10, FR-13, FR-18. Dependencies: T006.

Acceptance criteria:
- Validate all bundled positive and negative examples.
- Separate staff authoring payloads from child/public serialization, especially answer keys.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T008 — Implement checked database migrations

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-02, FR-10, FR-13, FR-18. Dependencies: T002, T007.

Acceptance criteria:
- Generate auth schema and domain migrations with correct foreign keys.
- Test clean apply and ownership/completion uniqueness constraints on PostgreSQL.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T009 — Create guarded synthetic demo fixtures

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: S

Requirements: FR-13, FR-15, FR-18. Dependencies: T007, T008.

Acceptance criteria:
- Seed only clearly marked non-production data and missing-audio states.
- Production startup/publication refuses demo flags, fixtures and test consent methods.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T010 — Review trust boundaries and threat cases

Status: **todo** · Priority: P0 · Owner: Security + engineering · Effort: M

Requirements: FR-03, FR-13, FR-15. Dependencies: T003, T004.

Acceptance criteria:
- Map parent/child/staff capabilities and mounted-auth bypass risks.
- Write negative-test inventory for ownership, answer leakage, replay, imports and exports.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

## M1

### T011 — Integrate adult authentication

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-01. Dependencies: T002, T008, T010.

Acceptance criteria:
- Use the maintained auth library for identity/password/session flows.
- Keep secrets server-side; verify auth routes work behind the same-origin proxy.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T012 — Implement email verification and recovery

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-01. Dependencies: T011.

Acceptance criteria:
- Unverified account cannot create a real child profile.
- Recovery/verification expiry and resend limits have tested safe UI states.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T013 — Enforce server-side parent gate

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-03. Dependencies: T011, T008.

Acceptance criteria:
- Password reauthentication creates a five-minute server gate.
- Entering child mode, expiry and identity changes revoke adult privileges.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T014 — Guard the mounted authentication routes

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-01, FR-03. Dependencies: T013.

Acceptance criteria:
- Define a child-mode allowlist for safe auth-library routes.
- Direct account/session/email mutation attempts cannot bypass the app parent gate.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T015 — Implement consent and eligibility state machine

Status: **todo** · Priority: P0 · Owner: Engineering + privacy · Effort: L

Requirements: FR-01, FR-15. Dependencies: T003, T012, T013.

Acceptance criteria:
- Versioned family/child consent actions use server-validated assurance references.
- Unconfigured production policy blocks enrollment; demo assurance is local/test only.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T016 — Implement parent-owned child profiles

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-02. Dependencies: T008, T013, T015.

Acceptance criteria:
- Nickname/avatar/age-band inputs validate and exclude unnecessary personal fields.
- Three-profile limit is race-safe and all CRUD operations are owner-scoped.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T017 — Implement active child and mode switching

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-02, FR-03. Dependencies: T016, T014.

Acceptance criteria:
- Active child is stored in server session context and entering child mode clears the adult gate.
- Switch/logout clears audio, query caches and pending personal UI state.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T018 — Create scoped repositories and authorization tests

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-02, FR-03, FR-15. Dependencies: T016.

Acceptance criteria:
- Every private lookup receives authenticated owner context.
- Cross-parent read/write/select/delete attempts have consistent denial responses.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T019 — Serve one demo lesson through safe serialization

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-05, FR-13. Dependencies: T007, T009, T018.

Acceptance criteria:
- Local-only published-demo view returns only permitted child fields.
- No correct options, internal notes, reviewer identities or provider secrets escape.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T020 — Create pinned learning sessions

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-05, FR-10. Dependencies: T017, T019.

Acceptance criteria:
- Sessions pin a lesson version and derive child identity from the server context.
- Concurrent session creation respects the one-writable-session rule and idempotency.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T021 — Accept ordered idempotent learning events

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-10. Dependencies: T020.

Acceptance criteria:
- Atomic batches validate session/unit ownership and contiguous sequences.
- Identical retries reuse results; conflicting event IDs or sequence gaps fail safely.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T022 — Finish sessions and award first-completion stars

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-10. Dependencies: T021.

Acceptance criteria:
- Completion requires all server-defined units.
- Concurrent/repeated finish returns one completion and at most one logical-lesson star.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T023 — Build usable child home and demo activity

Status: **todo** · Priority: P0 · Owner: Engineering + design · Effort: M

Requirements: FR-04, FR-17. Dependencies: T005, T017, T019, T022.

Acceptance criteria:
- At 390 px a real continue/start action is visible without squeezing cards.
- First-use, resumed, no-content and pending-save states use actual data.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T024 — Build a real gated parent progress slice

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-11. Dependencies: T022, T013.

Acceptance criteria:
- Read real scoped lesson completion and active-time state from database.
- Empty data is labeled honestly and reports require a live parent gate.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T025 — Prove the end-to-end safe slice

Status: **todo** · Priority: P0 · Owner: QA + engineering · Effort: L

Requirements: FR-01, FR-02, FR-03, FR-10, FR-11. Dependencies: T012, T014, T015, T018, T023, T024.

Acceptance criteria:
- Run adult setup → child lesson → finish → parent report on a real local database.
- Exercise alternate-parent IDs, direct parent URLs and replayed completion requests.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

## M2

### T026 — Implement catalog search and filters

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-05. Dependencies: T019, T023.

Acceptance criteria:
- Only eligible published content is searchable; no web search dependency.
- Debounced search cancels stale requests and has empty/error/no-result states.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T027 — Implement versioned stages and prerequisites

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-05. Dependencies: T020, T022.

Acceptance criteria:
- Curriculum graph validation rejects cycles and broken logical lesson references.
- Locked states offer a valid next step and stable reporting denominator.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T028 — Build the single audio controller

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-06. Dependencies: T005, T023.

Acceptance criteria:
- Play/pause/loading/buffering/ended/unavailable states are deterministic.
- Route switch, profile change and stale media callbacks cannot play/advance the wrong lesson.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T029 — Implement authorized media delivery

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-06, FR-07, FR-13. Dependencies: T019, T020.

Acceptance criteria:
- Only approved assets entitled by published/current session content receive short-lived URLs.
- Private/quarantine/withdrawn assets and arbitrary user-submitted URLs are denied.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T030 — Implement listen-and-imitate steps

Status: **todo** · Priority: P0 · Owner: Engineering + design · Effort: M

Requirements: FR-06. Dependencies: T028, T029, T021.

Acceptance criteria:
- Requested audio and one/three repeats work without microphone permission.
- Practice acknowledgment is labeled as practice, not pronunciation assessment.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T031 — Implement short-surah and ayah practice UI

Status: **todo** · Priority: P0 · Owner: Engineering + content · Effort: L

Requirements: FR-07, FR-17. Dependencies: T030, T007.

Acceptance criteria:
- Render source-keyed Arabic, attribution and last accepted unit accurately with reviewed staging data.
- Missing media/content never falls back to generated recitation or fabricated text.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T032 — Assemble private question sessions and public choices

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-08, FR-09. Dependencies: T019, T020.

Acceptance criteria:
- Exactly five eligible reviewed questions/rounds are selected for configured pilot sets.
- Public question data omits the correct option and records presentation order server-side.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T033 — Implement first-response scoring and retries

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-08, FR-09, FR-10. Dependencies: T032, T021.

Acceptance criteria:
- Selected option membership and question/session/version mapping validate server-side.
- Retries preserve first-answer correctness and cannot duplicate reward/sequence effects.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T034 — Build quiz question and completion states

Status: **todo** · Priority: P0 · Owner: Engineering + design · Effort: M

Requirements: FR-08, FR-17. Dependencies: T033, T005.

Acceptance criteria:
- Five-question flow supports keyboard, large choices, feedback and retry.
- No timer pressure, hidden answer-key data or ungrounded performance claims.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T035 — Build five-round sound-matching game

Status: **todo** · Priority: P0 · Owner: Engineering + design · Effort: M

Requirements: FR-09, FR-17. Dependencies: T033, T028.

Acceptance criteria:
- Tap and keyboard interaction work without drag; optional drag shares selection logic.
- Playing/feedback/completed views are mutually coherent and use real reward results.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T036 — Implement resume and serial mutation queue

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-10, FR-16. Dependencies: T021, T028, T033.

Acceptance criteria:
- Answers, acknowledgments and heartbeats share ordered per-session submission.
- Reconnect replays original IDs; replaced/expired/recalled sessions cannot sync into another session.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T037 — Add parent memorization observations

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-07, FR-11. Dependencies: T024, T031.

Acceptance criteria:
- Only the owning gated parent can append an observation for a surah.
- Latest observation and history stay separate from automatic practice completion.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T038 — Implement active-time buckets and parent reports

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-10, FR-11. Dependencies: T024, T033, T036.

Acceptance criteria:
- Server caps heartbeats and prevents multi-tab duration duplication.
- Weekly totals, quiz denominators, timezone labels and no-data states agree with stored records.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T039 — Build child achievements

Status: **todo** · Priority: P0 · Owner: Engineering + design · Effort: M

Requirements: FR-10. Dependencies: T022, T023.

Acceptance criteria:
- Stars come from unique logical-lesson completion records.
- Badges describe practice and contain no ranking, spending, streak loss or automatic hafal claim.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T040 — Implement soft session goals and comfort settings

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-12. Dependencies: T016, T028.

Acceptance criteria:
- Parent-selected goal offers a calm break without coercive lockout.
- Quiet and reduced-motion settings persist with correct child scope and audio semantics.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T071 — Build the requested public landing page

Status: **todo** · Priority: P0 · Owner: Engineering + design · Effort: M

Requirements: FR-04. Dependencies: T005, T012.

Acceptance criteria:
- Preserve the user headline and cover all eight feature benefits in responsive layout.
- Parent CTA, privacy/source routes and honest scope do not leak child-mode data.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T072 — Implement parent starting-stage and session replacement controls

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-05, FR-11. Dependencies: T027, T013.

Acceptance criteria:
- Only owning gated parent may change starting stage, unlock or replace an active session.
- Overrides do not award completion/rewards and replaced session writes are denied.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

## M3

### T041 — Provision staff capabilities and MFA gates

Status: **todo** · Priority: P0 · Owner: Engineering + operations · Effort: L

Requirements: FR-01, FR-13. Dependencies: T011, T010.

Acceptance criteria:
- Admin routes require active provisioned role and current MFA evidence.
- Content staff cannot read child reports or impersonate families.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T042 — Implement source/rights registry

Status: **todo** · Priority: P0 · Owner: Engineering + rights · Effort: M

Requirements: FR-13. Dependencies: T041, T004.

Acceptance criteria:
- Store source versions, attribution, evidence, allowed use and reviewer decisions.
- Pending/denied/revoked rights block content publication.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T043 — Implement quarantined media upload and verification

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-13. Dependencies: T041, T042.

Acceptance criteria:
- Signed uploads are constrained; actual bytes/MIME/size/checksum/decoding are validated.
- Unverified files cannot be streamed to child sessions.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T044 — Build allowlisted source import adapters

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-13. Dependencies: T042, T043.

Acceptance criteria:
- Imports use registered source/object/adapter IDs, not unrestricted URL fetching.
- Provider credentials/environment permissions are server-only and failures are redacted.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T045 — Validate canonical text and audio mappings

Status: **todo** · Priority: P0 · Owner: Engineering + content · Effort: L

Requirements: FR-07, FR-13. Dependencies: T044.

Acceptance criteria:
- Approved source metadata validates verse keys/counts and immutable hashes.
- Every pilot segment has recorded human text/audio alignment checks before production.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T046 — Build structured lesson editor and staff preview

Status: **todo** · Priority: P0 · Owner: Engineering + design · Effort: L

Requirements: FR-13. Dependencies: T043, T045, T007.

Acceptance criteria:
- Editor validates units/options/references and shows precise blocking errors.
- Draft preview stays staff-only; changes after review require a new candidate/review.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T047 — Build curriculum release editing and review

Status: **todo** · Priority: P0 · Owner: Engineering + content · Effort: L

Requirements: FR-05, FR-13. Dependencies: T027, T046.

Acceptance criteria:
- Validate order, stage and prerequisite DAG with stable denominator.
- Distinct reviewer and immutable release hash are required before publishing.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T048 — Implement review and publish transactions

Status: **todo** · Priority: P0 · Owner: Engineering + content · Effort: L

Requirements: FR-13. Dependencies: T041, T042, T045, T046.

Acceptance criteria:
- Author cannot approve their own candidate and published payloads cannot be edited in place.
- Rights, hash, audio and question-count failures prevent publication atomically.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T049 — Implement recall and content-status invalidation

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-14. Dependencies: T048, T029, T036.

Acceptance criteria:
- Recalled content disappears from new catalog/session/media access.
- In-flight sessions stop on the next check with safe return path and historical progress retained.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T050 — Build parent content reporting and triage

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-14. Dependencies: T013, T049.

Acceptance criteria:
- Reason codes and optional short notes are owner-gated and private.
- No child audio/photo attachments or public report publication.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T051 — Implement redacted audit trail

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-13, FR-18. Dependencies: T041, T048, T049.

Acceptance criteria:
- Privileged actions include actor, object, request ID, outcome and immutable time.
- Audit metadata excludes raw child fields, passwords, signed URLs and support text.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

## M4

### T052 — Implement withdrawal and reconsent enforcement

Status: **todo** · Priority: P0 · Owner: Engineering + privacy · Effort: M

Requirements: FR-15. Dependencies: T015, T036.

Acceptance criteria:
- Family withdrawal blocks all profiles; child withdrawal blocks that profile immediately.
- New consent requires approved current flow and revoked sessions cannot continue writing.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T053 — Implement private export jobs

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: L

Requirements: FR-15. Dependencies: T024, T037, T041.

Acceptance criteria:
- Owner-gated export includes only permitted family data with schema notes.
- Downloads expire, enforce ownership and omit secrets/answer keys/internal evidence.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T054 — Implement deletion and backup suppression

Status: **todo** · Priority: P0 · Owner: Engineering + privacy · Effort: L

Requirements: FR-15. Dependencies: T052, T053.

Acceptance criteria:
- Deletion immediately revokes access and idempotent jobs remove active data/objects.
- A minimized suppression ledger prevents deleted profiles returning after restore.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T055 — Enforce request security and distributed limits

Status: **todo** · Priority: P0 · Owner: Engineering + security · Effort: L

Requirements: FR-01, FR-03, FR-15, FR-18. Dependencies: T014, T033, T043.

Acceptance criteria:
- CSRF/origin/cookie/CSP/body-size controls are verified on real routes.
- Rate limits remain effective across configured API replicas and do not expose account existence.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T056 — Implement installable shell and explicit offline states

Status: **todo** · Priority: P0 · Owner: Engineering · Effort: M

Requirements: FR-16. Dependencies: T036.

Acceptance criteria:
- Service worker caches only static shell/assets, not private API/content/media.
- Cold offline, in-memory queue limit and reload loss are accurately explained.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T057 — Verify responsive and accessible flows

Status: **todo** · Priority: P0 · Owner: Design + QA · Effort: L

Requirements: FR-04, FR-08, FR-09, FR-11, FR-17. Dependencies: T031, T034, T035, T038.

Acceptance criteria:
- Capture 320/390/768/1024/1440 layouts and keyboard/200%-zoom checks.
- Check contrast, tap alternatives, focus, screen-reader feedback and chart table equivalents.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T058 — Review actual Arabic rendering

Status: **todo** · Priority: P0 · Owner: Content + QA · Effort: M

Requirements: FR-07, FR-17. Dependencies: T045, T031.

Acceptance criteria:
- Use reviewed source text with marks on mobile Safari/Chrome and desktop browsers.
- No clipped marks, accidental translation, reversed strings or screenshot-sourced glyph content.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T059 — Measure performance budgets

Status: **todo** · Priority: P0 · Owner: Engineering + QA · Effort: M

Requirements: FR-18. Dependencies: T038, T057.

Acceptance criteria:
- Record test hardware/network and actual LCP/INP/CLS/API latency measurements.
- Investigate oversized bundles, media latency and unnecessary rerenders; do not report unmeasured targets as results.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T060 — Audit logs, frontend bundles and outbound calls

Status: **todo** · Priority: P0 · Owner: Security + engineering · Effort: M

Requirements: FR-15, FR-18. Dependencies: T051, T053, T055.

Acceptance criteria:
- No provider secret, password, answer key or private field leaks to child/public responses/logs.
- No ads, tracking pixels, session replay or microphone/camera calls exist in MVP.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T061 — Implement deployment and idempotent workers

Status: **todo** · Priority: P0 · Owner: Engineering + operations · Effort: L

Requirements: FR-18. Dependencies: T051, T053, T054.

Acceptance criteria:
- Document real environment setup, health/readiness, job leases/retries and rollback.
- Production startup validates secrets/policy flags and forbids fixture mode.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T062 — Exercise restore and deletion replay

Status: **todo** · Priority: P0 · Owner: Operations + QA · Effort: L

Requirements: FR-15, FR-18. Dependencies: T054, T061.

Acceptance criteria:
- Restore an isolated backup and measure actual RPO/RTO outcomes.
- Reapply suppression ledger and verify source pointers/ownership before declaring recovery.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T073 — Test replay, races and reporting invariants

Status: **todo** · Priority: P0 · Owner: QA + engineering · Effort: L

Requirements: FR-08, FR-09, FR-10, FR-11. Dependencies: T021, T022, T033, T038, T072.

Acceptance criteria:
- Run concurrent session/answer/finish/profile-create tests against PostgreSQL.
- Replay, version change, zero denominator, timezone and heartbeat cases retain correct results.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T074 — Complete empty/error/permission/recall UI states

Status: **todo** · Priority: P0 · Owner: Engineering + design + QA · Effort: M

Requirements: FR-01, FR-04, FR-06, FR-11, FR-13, FR-14, FR-15, FR-16, FR-17. Dependencies: T031, T035, T049, T053, T056, T071.

Acceptance criteria:
- Every data screen has tested loading, empty, denied, expired and recoverable-error behavior.
- Child content recall/offline paths and parent privacy-job failures remain safe and understandable.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

## M5

### T063 — Approve production content rights

Status: **todo** · Priority: P0 · Owner: Rights owner · Effort: M

Requirements: FR-06, FR-07, FR-13. Dependencies: T042, T045.

Acceptance criteria:
- Obtain/document actual source, recording, streaming and distribution permissions.
- Record approved attribution and any caching/offline restrictions; unresolved rights remain blocked.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T064 — Approve pilot curriculum and all mappings

Status: **todo** · Priority: P0 · Owner: Qualified content reviewer · Effort: L

Requirements: FR-05, FR-06, FR-07, FR-08, FR-09, FR-13. Dependencies: T045, T047, T048, T063.

Acceptance criteria:
- Human reviewer distinct from author checks text/audio/questions and stage sequence.
- Evidence references exact release hashes, not generic approval of the app.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T065 — Approve market, eligibility, consent and retention policy

Status: **todo** · Priority: P0 · Owner: Privacy/legal owner · Effort: L

Requirements: FR-01, FR-02, FR-15. Dependencies: T003, T015, T052, T054, T060.

Acceptance criteria:
- Resolve applicable Indonesian 2026 framework and any other launch markets.
- Record signed policy/assurance/processor/notice decisions before enabling child enrollment.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T066 — Finalize production artwork and missing screen states

Status: **todo** · Priority: P0 · Owner: Design + rights owner · Effort: M

Requirements: FR-04, FR-17. Dependencies: T057, T058.

Acceptance criteria:
- Use licensed/original assets with rights evidence, not whole-screen screenshot slicing.
- Review onboarding/gate/ayah/privacy/admin states and responsive screenshots not supplied as original concepts.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T067 — Run supervised usability pilot

Status: **todo** · Priority: P0 · Owner: Product + design + privacy · Effort: L

Requirements: FR-04, FR-06, FR-08, FR-09, FR-11, FR-17. Dependencies: T025, T064, T065, T066.

Acceptance criteria:
- Use the approved participant/consent protocol and record actual task observations.
- Assess child navigation and parent interpretation of practice versus memorization without overstating efficacy.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T068 — Resolve pilot defects and run complete regression

Status: **todo** · Priority: P0 · Owner: QA + engineering · Effort: L

Requirements: FR-01, FR-02, FR-03, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18. Dependencies: T059, T060, T062, T067, T071, T073, T074.

Acceptance criteria:
- Attach real automated/manual results for the full requirement matrix.
- No unresolved critical/high security issue or known critical content defect remains.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T069 — Run production preflight and incident drills

Status: **todo** · Priority: P0 · Owner: Operations + product · Effort: M

Requirements: FR-13, FR-14, FR-15, FR-18. Dependencies: T061, T062, T063, T064, T065, T068.

Acceptance criteria:
- Verify deployment, recovery, source recall, export/deletion and incident contacts.
- Confirm no demo records, fake statistics or unapproved source releases are published.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.

### T070 — Record explicit human release decision

Status: **todo** · Priority: P0 · Owner: Product + content + privacy + engineering · Effort: S

Requirements: FR-18. Dependencies: T069.

Acceptance criteria:
- Each required owner signs the applicable release gates with evidence.
- Agent reports remaining limits honestly and does not self-authorize public deployment.

Evidence to attach: changed files; commands/tests and actual outcomes; applicable screenshots or human sign-off.
