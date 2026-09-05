# Delivery Plan & Definition of Done

## 1. Delivery approach

Build a small complete path before broad screen coverage. A static prototype of every screen is not an implemented MVP. Milestones are dependency gates, not promised calendar dates. Backlog effort bands are relative planning aids: S=roughly a focused small change, M=several related components, L=complex integration/test work, XL=split before implementation. They are not hours or fixed commitments.

Suggested responsibilities: product owner, full-stack engineer/agent, design reviewer, qualified Qur'an/curriculum reviewer, privacy/legal owner and release/operations owner. One person may cover compatible roles, but content author and reviewer must remain distinct.

## 2. Milestone gates

### M0 — Foundation and executable decisions

Inspect existing repository; record exact dependency versions; create workspace and CI; define tokens/public serializers; validate schemas/fixtures; draft threat/source inventories; assign launch-decision owners. Exit: a clean dev build, contracts validated, no production secrets/demo bypass leakage and explicit open decision list.

### M1 — Safe end-to-end slice

Verified adult account → policy/consent state → child profile → child mode → one local demo Hijaiyah activity → persisted validated completion → gated parent summary. Include owner-isolation and gate-bypass tests now. Exit: this flow works against a real local database, not browser-only state or a fake report card.

### M2 — Learning experience

Catalog/path, audio controller, short-surah activity using reviewed staging content when available, shared quiz/game engine, resumption, deterministic rewards, parent assessment and comfort settings. Exit: all core learning states work and scores/progress come from the server. Unavailable licensed audio stays a visible blocker, not a fake completion.

### M3 — Content operations

Source registry, quarantined asset/import flow, structured lesson editor, curriculum release, distinct review, publication/recall and redacted audit. Exit: test publication cannot bypass rights/review gates, and recalled content stops new play safely.

### M4 — Hardening and privacy

Export/delete/withdraw, network failure behavior, accessibility/manual Arabic checks, responsive refinement, rate limiting, security/logging tests, performance budget verification and documented deployment/restore. Exit: P0 automated checks pass and manual evidence is attached.

### M5 — Controlled pilot and release decision

Obtain content/rights/legal approvals; rehearse restore/recall; run supervised child/parent usability sessions with appropriate consent; reconcile results and remaining risks. Exit: named humans sign the release checklist. An AI agent cannot self-approve these gates.

## 3. First three practical slices

Slice A: tokens and navigation + verified adult session + gated child creation. Slice B: demo letter lesson + learning session/event/finish transaction + real parent summary. Slice C: reviewed audio adapter + play/pause/failure states + quiz/game first-answer engine. Keep UI, API, DB and tests together within each slice.

## 4. Task lifecycle

Statuses: todo, ready, in_progress, blocked, review, done. Mark ready only when dependencies and necessary decisions are resolved. A task in review has implementation evidence but awaits review; it is not done. Blocked items include exact missing input and decision owner. Every task records requirement IDs, dependencies, acceptance criteria and test evidence.

The JSON backlog is a tool-neutral import format. It is not claimed to be a native Jira/Linear/GitHub issue format. When importing, preserve IDs and dependencies; do not create external issues or publish repo changes without authorization.

## 5. Definition of done per task

Behavior satisfies acceptance criteria; types and contract checks pass; meaningful unit/integration tests exist; no regressions in adjacent flows; responsive and a11y checks are captured when UI changes; docs/schema match implementation; errors and empty states are covered; secrets/PII are absent; reviewer accepts the change.

A file existing is not evidence that a feature works. Do not count stubbed endpoints, disabled tests, TODO validation or mocked database persistence as delivery of production behavior.

## 6. Scope management

Keep the eight requested capabilities in MVP through narrow implementations. Defer new games, offline packs, social features, payments, native apps and AI voice grading. A change request must state user value, affected requirements/contracts, safety/privacy consequences, dependencies, effort and release impact.

Changes to child data collection, content licensing, source edition, parent-assessment semantics or authorization require explicit owner review. Visual polish cannot justify weakening source or ownership checks.

## 7. Review evidence

Each milestone report includes changed files, migration IDs, commands actually executed, summarized results, screenshots at 390/768/1440 where relevant, untested cases, open decisions and next tasks. Store evidence in the implementation repository. The `qa/` folder in this handoff documents only package validation, not application test results.
