# Technical Architecture

## 1. System shape

A modular monolith is sufficient: one responsive React web application, one Bun/Elysia API, one PostgreSQL database and private object storage/CDN delivery for approved media. A small worker process from the same repository handles imports, exports and deletion. Use a PostgreSQL job table rather than introducing a queue platform for this initial scale.

This is a structured-content learning product. It has no semantic retrieval problem that requires embeddings, no need for a chatbot and no reason to generate religious content at runtime.

## 2. Proposed stack and verification policy

| Layer | Proposed choice | Constraint |
| --- | --- | --- |
| Web | React + TypeScript + Vite | Mobile-first SPA; no unnecessary SSR migration |
| UI | Tailwind CSS + shadcn/ui primitives | Apply custom child-friendly tokens, not default enterprise styling |
| Routing/data | React Router + TanStack Query | Pin versions; use generated/typed API DTOs |
| API | Bun + Elysia | Use a supported compatible stable release; do not assume a major called Elysia 2 |
| Auth | Better Auth | Adult identity only; app gate and authorization remain application concerns |
| Database | PostgreSQL + Drizzle | One relational system; checked migrations |
| Files | S3-compatible private bucket | Signed entitlement delivery; approved public illustrations separate |
| Jobs | PostgreSQL-backed job rows + worker | Leases, retries and idempotent handlers |
| Testing | Vitest, API integration tests, Playwright, accessibility tooling | Exact libraries pinned after compatibility spike |
| Packaging | Bun workspace + lockfile | Vite build runtime requirements separately validated |

Official integration references [S01–S04] support this proposed combination; they are not a claim that a particular untested dependency matrix works. Capture actual versions, runtime, migrations and compatibility-test results in the repository before M1.

## 3. Trust boundaries

Browser → same-origin HTTPS application/API → PostgreSQL/private storage. Provider requests occur only in the importer or backend adapter. The browser never has upstream client secrets, admin credentials, canonical source download tokens or database access.

Use `/api/auth/*` for the mounted auth provider and `/api/v1/*` for domain routes. A reverse proxy serves the web bundle and forwards both API prefixes. Authenticated responses are `Cache-Control: no-store`; the service worker must not intercept/cache them. Static hashed JS/CSS/illustrations may be cached long-term. Do not cache private responses at the CDN.

At local development, proxy `/api` through Vite to keep browser interaction same-origin. Production CORS is denied by default; permit only the selected origin when explicitly needed. State-changing requests require valid origin and the configured CSRF mechanism. SameSite cookies alone are not the full CSRF strategy.

## 4. Modules and responsibilities

`identity`: adult auth integration, profile creation prerequisites, server session controls and staff capability lookup.

`families`: parent-owned child profiles, selection, goals, consent ledgers, parent assessments and deletion orchestration.

`content`: sources, licenses, assets, structured lesson versions, quizzes, curriculum releases, approval and recall.

`learning`: session issuance, immutable lesson assignment, unit events, answer verification, completion, progress projection and rewards.

`reporting`: scoped summaries, time-bucket queries and export assembly. Do not turn it into a generic analytics pipeline.

`operations`: job runner, audit, health/readiness, retention, content-recall cache invalidation and administrative limits.

Separate transport handlers, authorization policies, business services and database repositories. A route may not assemble an unscoped query directly. Repository methods accept an authenticated context, not a raw arbitrary parent ID.

## 5. Adult authentication and the parent gate

Use the auth library's session handling, verified-email flow, password hashing and recovery. Do not invent password cryptography. Configure password policy, session expiry and account recovery in the version-checked implementation.

Create one `session_controls` row keyed to the auth session identifier. It contains parent ID, mode (`parent`/`child`), active child ID, `adult_gate_until`, last verification time and revocation status. No cookie exposes the password or gate proof. Gate unlock validates the password through the supported auth-library API and extends the gate for five minutes. Do not accept a client boolean or unsigned timestamp.

Entering child mode sets mode=child, selects the owned eligible child and sets adult_gate_until=NULL in one transaction. Parent-only requests require mode=parent and a live gate. The gate is an additional authorization predicate, not a replacement for adult authentication or legal consent. Sensitive exports/deletions also verify current consent/account state and fresh reauthentication.

**Mounted-handler bypass:** the adult auth library often exposes account/profile/session update routes. Maintain a reviewed allowlist of auth routes callable in child mode. Recovery/sign-out can be safe exceptions; account updates, linked-account operations, email changes and session management require an adult gate. Reset a gate on sensitive identity changes. Add explicit API bypass tests; hiding the parent's pages does not protect these routes.

Staff access checks provisioned capabilities (`content_editor`, `content_reviewer`, `content_publisher`, `ops_admin`) and MFA verification. Staff roles do not grant access to parent/child personal data. Staff accounts must not enter a child's session by impersonation in MVP.

## 6. Learning session flow

1. Browser requests `POST /learning/sessions` with logical lesson ID and an idempotency key. Active child comes from session context.
2. Server validates consent, ownership, stage access and a currently published version. It pins that immutable version and prepares the permitted question/option order.
3. Server returns a public session DTO without answer keys, plus a short activity lease. Enforce one writable active learning session per child; a new device gets a conflict and can explicitly replace the old session.
4. Browser sends ordered unit/heartbeat/answer events with UUID event IDs and a session-specific client sequence.
5. Server locks the session row, verifies the unit/question belongs to the pinned version/session, applies authorization and stores the first accepted result.
6. In one transaction, update session progress, immutable completion event, lesson aggregate and unique reward if all required units are done. Return server-authoritative next state.
7. Parent summary reads projections and time buckets; it never trusts a client percentage.

Replace-session requires an explicit parent-gated confirmation when another device is active. The revoked session's next request receives `SESSION_REPLACED`; it stops playback and retains only already accepted history.

## 7. Audio architecture

Use one application-level audio controller around an HTML audio element. Keep media state independent of React render frequency. A new source increments a generation token so stale `ended`/error handlers cannot advance a different lesson. Stop on route change, profile switch, logout or recall.

Media delivery is through `GET /media/{assetId}/playback`, after a published entitlement and session check. Return a short-lived signed URL (proposed five minutes), MIME type and known duration. Support range requests at storage/CDN. Do not embed arbitrary provider URLs submitted by a child. Browser clients must not log signed URLs or leak them via referrer headers.

For Qur'an Foundation, use a backend adapter with approved credentials/permissions [S12]. Keep the learning runtime independent of a live provider by using legally permitted, reviewed content snapshots or licensed hosted assets. Availability of an API URL is not permission to redistribute or download the recording. Provider and reciter choices remain launch decisions.

No microphone, speech recognition or TTS recitation in MVP. Imitation is an instruction to the child, followed by self-acknowledged practice. A timed heartbeat can estimate activity; it cannot validate pronunciation or attention.

## 8. Content model and publication

Canonical raw source and asset bytes are immutable and identified by checksum. Lesson content is structured JSON validated by schema; it references canonical verse keys and asset IDs. Public serialization omits internal notes, answer keys, rights evidence and reviewer identities. A lesson version changes status through draft → in_review → approved → published → retired, with a separate recall action.

Publication service revalidates rights, review separation, script/audio mappings, required-unit counts, curriculum acyclicity and quiz item counts. Lock the candidate row and source/asset dependencies for the publish transaction. Changes after approval create a new candidate; they do not modify the approved payload. A published release pointer can move to another approved version without rewriting sessions.

Emergency recall sets status=recalled, bumps content revision, revokes new playback entitlements and rejects further events with `CONTENT_RECALLED`. Runtime checks recall on every write/start and on player return from background; status caches must expire within five minutes. Already delivered bytes cannot be remotely “unseen.”

## 9. Consistency and concurrency

Use PostgreSQL transactions with row locks for per-session ordering and completion. Composite foreign keys ensure a session/event/projection belongs to the same child. `UNIQUE(child_id, lesson_id, reward_type)` prevents first-completion stars from duplicating across versions. `UNIQUE(session_id, question_id)` records one first answer.

Transport idempotency: key scoped to actor/session + method + route, request hash, result snapshot, proposed retention 24 hours. Domain event IDs remain permanently unique within retained activity records. Reusing an event ID with a different payload returns 409; retries with identical content return the original outcome. Roll back partial writes on validation errors for atomic batches, as defined in the API document.

Do not retry whole transactions blindly when they would resend external email or exports. Outbound side effects use a job row inserted in the same transaction; the worker claims and marks work idempotently.

## 10. Offline and network failure policy

MVP requires internet for starting a lesson, fetching media and authoritative progress. Cache only static app shell assets. During a temporary disconnection, already rendered tasks can remain visible and a maximum of 20 pending events may remain in memory for the current session. No persistent IndexedDB progress queue or background sync in this release.

If the queue fills, pause advancement with a retry message. After reload, unsent work may be lost; never say “saved” until acknowledged. Resend identical event IDs and sequence numbers after reconnect. Expired/replaced/recalled sessions cannot silently sync stale completion into a new session.

Offline packs would require a separate rights, encrypted/local-data, revocation and conflict-resolution design; they are not a free consequence of an installable web shell.

## 11. Deployment shape

One region close to the pilot users, selected after latency, processor/legal and budget review. Static web bundle via reverse proxy/CDN; API and worker as containers; managed PostgreSQL and private object storage. No vendor-specific pricing is assumed.

Use separate local/test/staging/production databases, buckets and provider credentials. Production rejects demo fixtures, demo consent bypass and unknown content rights. Secrets come from a deployment secret store, never `VITE_*` variables or committed `.env` files. Readiness verifies DB connectivity and critical config without exposing credentials.

Reference diagrams are in the data/flow text and repository layout; the architecture is intentionally small. Scale after actual demand measurements rather than by adding infrastructure preemptively.
