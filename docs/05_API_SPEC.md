# API Contract Guide

Machine contract: `contracts/openapi.yaml` (OpenAPI 3.1). JSON uses snake_case and UTF-8. The application API prefix is `/api/v1`. The auth-library routes under `/api/auth/*` are deliberately not reimplemented in this domain contract; use the pinned library's documented routes and apply the child-mode allowlist.

## 1. Request and response conventions

IDs are UUID strings except external auth identifiers and stable catalog keys. Timestamps are RFC 3339 UTC strings; reporting boundaries use ISO dates with the profile/session timezone rules in the data model. Store database timestamps in UTC. Lists default to 20 items, maximum 50, with opaque cursor pagination and deterministic ordering. Cursors are not authorization tokens.

Successful object responses return the typed object directly. Lists return `{items, next_cursor}`. Errors use `{error:{code,message,request_id,details?}}`; `message` is safe Indonesian UI copy. Details never include SQL, secrets, another parent's resource existence or a correct answer key.

All authenticated personal responses are `Cache-Control: no-store`. Production requires HTTPS, secure HTTP-only cookies, same-origin requests and explicit CSRF/origin validation for mutations. Domain endpoints do not accept a caller-specified parent ID or child ID in child-mode writes.

## 2. Capabilities

`public`: public landing resources and limited health status only.

`adult_session`: verified adult identity; permits safe self/session reads and gate operations. Verification/consent onboarding can present parent-only state before eligibility passes.

`parent_gate`: active adult session, server mode=parent and adult_gate_until in the future. All child administration, parent reporting, consent changes, exports and deletion require this capability. Required recent-auth assurance must be revalidated for sensitive changes.

`child_session`: active adult identity, mode=child, owned active child selected and effective consent/eligibility valid. Learning routes derive child ID from this context.

`staff_*`: independent provisioned role and MFA. Content roles are scoped to their action. Staff does not imply parent access.

The OpenAPI `x-capability` annotation is normative application authorization metadata, not something OpenAPI tooling automatically enforces. Cookie authentication alone is insufficient.

## 3. Idempotency and ordering

POST endpoints that create sessions, finish sessions, submit answers, create children, start exports/deletions or publish content require `Idempotency-Key`. Reuse a UUID key for a retry of the same request; generate a new key for a new intent. Keys are scoped to actor, HTTP method and canonical route. Same key/same request hash returns the stored HTTP status/body; same key/different request hash returns 409 IDEMPOTENCY_CONFLICT. Never persist gate passwords in idempotency storage. Always recheck current authorization before returning a stored replay. A replay is not a capability grant. If the child-mode transition response is lost, fetch `/me` to recover the current child-safe state instead of expecting an expired parent gate to replay the transition. Reopening parent mode requires fresh reauthentication.

Events additionally have domain `event_id`, `sequence` and optional bounded `client_at`. Sequence starts at 1 per learning session. A batch accepts up to 20 events; total JSON body limit is 64 KB. Entire batch is atomic for new events. Out-of-order new events return 409 EVENT_SEQUENCE_CONFLICT with the last accepted sequence; the client resends pending events in order. Duplicate IDs with different content return EVENT_ID_CONFLICT.

Answers use the same sequence stream as other learning events. A client queues all session mutations serially rather than sending heartbeats and answers concurrently. The server serializes them via the session row lock. Finish is idempotent but does not consume an activity event sequence; it observes all earlier accepted events.

## 4. Learning events

`unit_acknowledged`: identifies a unit after its required interaction. For letter/surah listening, it confirms practice acknowledgment, not pronunciation. For choice units, require a first answer and feedback acknowledgment. The server decides whether the unit is eligible to complete.

`heartbeat`: contains `active_ms` from 0 to 15,000. Server caps it again using elapsed time. The client cannot send completion/reward totals.

`paused`: contains a reason enum (`user`, `hidden`, `network`). Stops active-time accrual and moves the session to paused, while preserving resumable state.

`resumed`: requests reactivation of the same non-expired session after authorization/content recheck. The next heartbeat establishes a new anchor.

Answers are submitted to the typed answer endpoint, not as arbitrary event payloads. A correct-answer value is never accepted from the browser. Question and selected option must belong to the server-issued session.

## 5. Essential route families

| Family | Behavior |
| --- | --- |
| `/me`, `/parent/gate` | Safe current context, reauthentication and lock |
| `/parent/consents` | Versioned grant/withdraw actions with server-validated assurance |
| `/parent/children` | Owned profiles and settings, gate required |
| `/parent/children/{child_id}/enter` | Select owned child and drop adult gate |
| `/parent/children/{child_id}/progress` | Scoped interval summary |
| `/parent/children/{child_id}/assessments` | Parent observations, not model grades |
| `/parent/exports`, `/parent/deletion`, `/parent/jobs/{job_id}` | Asynchronous privacy operations |
| `/catalog`, `/lessons/{lesson_id}` | Published, filtered public learning DTOs |
| `/learning/sessions*` | Pin content, accept events/answers, finish safely |
| `/learning/progress` | Child-safe achievements/current practice summary |
| `/media/{asset_id}/playback` | Short-lived approved media delivery |
| `/admin/sources`, `/admin/assets`, `/admin/imports` | Source/rights registry and quarantined ingestion |
| `/admin/versions*`, `/admin/curricula*` | Structured review/publish/recall |
| `/admin/audit` | Redacted privileged action history |

Account deletion returns its receipt in the initial accepted response and then revokes the account sessions. Do not let a revoked account poll `/parent/jobs/{job_id}`; progress polling is only for still-authorized accounts and owned jobs. A final account-deletion confirmation uses the privacy-owner-approved parent contact/support channel and contains no child details. If the receipt response is lost, use that channel rather than reviving the deleted session.

Full requests/responses and operation IDs are in OpenAPI. Where the body is structured lesson JSON, the external authoring schema is embedded/referenced explicitly. No empty “TODO” endpoint bodies are intended.

## 6. Error codes and UI behavior

| HTTP | Code | Meaning and client response |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Show field-level correction; do not retry unchanged |
| 401 | AUTH_REQUIRED | Stop audio, clear private caches, open adult sign-in |
| 403 | PARENT_GATE_REQUIRED | Open adult gate without exposing target data |
| 403 | CONSENT_REQUIRED | Pause writes and show parent guidance |
| 403 | ELIGIBILITY_BLOCKED | Parent-only state; do not create child data |
| 403 | CAPABILITY_REQUIRED | No role escalation; safe access-denied screen |
| 404 | NOT_FOUND | Unknown or not-owned private object; same outward response |
| 409 | IDEMPOTENCY_CONFLICT | New intent needs a new key; investigate client mismatch |
| 409 | EVENT_SEQUENCE_CONFLICT | Fetch current state and reconcile ordered pending events |
| 409 | EVENT_ID_CONFLICT | Do not fabricate a new event to hide mismatched replay |
| 409 | SESSION_IN_USE | Explain active session; parent may replace it explicitly |
| 409 | SESSION_REPLACED | Stop old session and return to child home |
| 409 | SESSION_EXPIRED | Preserve accepted progress; start a new session |
| 409 | INCOMPLETE_SESSION | Show remaining steps; no award |
| 409 | REVIEW_REQUIRED | Staff sees missing publication evidence |
| 410 | CONTENT_RECALLED | Stop playback; return to available content |
| 422 | CONTENT_INVALID | Source/asset/schema mapping does not meet publication rules |
| 429 | RATE_LIMITED | Honor Retry-After and show calm retry message |
| 503 | MEDIA_UNAVAILABLE | Retry playback later; never substitute fabricated audio |

Errors do not disclose whether an arbitrary child's ID exists. Gate and account recovery errors must avoid revealing unrelated account existence.

## 7. Proposed limits

Adult sign-in/gate attempts: five failed attempts per account and IP window of 15 minutes, with progressive delay and generic response; verify auth-provider configuration and avoid account-lockout denial of service. Learning events: at most 120 requests/minute per session, with the heartbeat behavior normally much lower. Export: one active export per parent and at most three per day. Profile creation is capped transactionally. Imports/uploads: staff only, allowlisted formats, 25 MB proposed per file, configurable after content inspection.

These are initial operational defaults; tune with pilot data. Use a distributed enforceable store or upstream limiter for more than one API replica. A purely per-process rate limiter is insufficient when horizontally scaled. PostgreSQL counters can suffice initially.

## 8. Media and import safety

Upload initialization returns a private quarantine object key and short-lived upload URL constrained by content type and size. A finalize/verify job checks the actual bytes, checksum and decodability; the client's MIME/checksum claim is not trusted. Asset verification does not automatically establish recitation rights or scholarly approval.

Provider imports use preconfigured adapter IDs and source registry entries. Reject arbitrary URL fetching, redirects to private addresses and cross-environment credential mixing. All media playback access checks both asset approval and association with published/currently entitled content. CDN/object-store referrers and logs must not leak parent or child IDs.

## 9. Contract discipline

Use server validation for every body, parameter and response DTO. Validate schema examples in CI. Generate type clients if useful, but do not expose backend-only fields through automatic ORM serialization. OpenAPI is the domain contract; changes require matching edits to service tests, docs and fixtures. External auth API behavior is separately version-pinned and tested, not guessed from this document.
