# Data Model & Domain Invariants

The reference DDL is in `database/domain-reference.sql`. It covers application-domain tables, not the authentication library's generated tables. It is a design reference to translate into versioned Drizzle migrations and test on PostgreSQL. Do not claim it is a complete production authorization layer.

## 1. Identity and household records

`parents`: UUID primary key, external auth-user identifier, timezone, eligibility status, lifecycle timestamps. Email/password reside in the auth system rather than being duplicated in learning tables. Supported account status is active, suspended or deletion_pending.

`children`: parent ID, nickname, avatar key, age band, status, curriculum release, selected stage, session goal, quiet/reduced-motion preference. The pair `(id,parent_id)` is unique to enable composite ownership constraints. Three-active-child limit is enforced in a transaction locking the parent row, not a race-prone count performed outside a transaction.

`session_controls`: auth session ID, parent ID, mode, active child ID, adult gate expiry and revocation time. `(active_child_id,parent_id)` must reference an owned child. Child mode requires a non-null active child and no adult gate. Auth-session validity is checked through the auth integration on each request.

`consent_records`: append-only parent/family or child-scoped actions, purpose, notice version, policy version, action, server-validated assurance method/reference and timestamp. A family grant is necessary for any child profile; a later family withdrawal blocks all profiles. A child-scoped withdrawal additionally blocks that profile. A new grant requires the approved flow, not merely changing a child status. Capture no raw identity documents in this table.

`staff_members`: auth-user identifier, provisioned capability set and active flag. Staff are separate from family ownership. MFA state must come from the live auth session, not a static database boolean. No self-service staff role escalation.

## 2. Content records

`content_sources`: an immutable source release identity, type, upstream reference, stated version, rights status, attribution, license/evidence references, reviewer and raw-object checksum. A changed source version gets another row. Rights may be suspended/revoked, but source bytes are never overwritten.

`media_assets`: source ID, object key, kind, MIME, byte size, SHA-256, duration when audio, validation state and permitted delivery policy. Private quarantine assets cannot be used in published lessons. Audio metadata must describe the actual media, not a guessed duration. Signed URLs are generated on demand and never stored as canonical identifiers.

`canonical_chapters` and `canonical_verses`: source-version-scoped chapter metadata and verse keys/text/checksums. `verse_key` is `chapter:ayah`, while numeric columns permit validation. Chapter verse counts come from the approved edition's metadata. Canonical text is immutable. Search/display helpers must never replace the canonical stored text.

`lessons`: stable logical lesson ID and stable key. `lesson_versions`: versioned title/type/stage, estimated minutes, lifecycle state, author/reviewer, release hash and timestamps. A logical lesson has at most one current published version; another can remain available to pinned historical sessions until retired/recall policy applies. Updating the current pointer does not rewrite historical activity.

`stage_overrides`: parent-owned per-child lesson unlocks with grant/revoke timestamps and a reason. These bypass a prerequisite only; they do not complete a lesson or award a star.

`lesson_units`: ordered immutable units within a version, type, requirement flag, letter or verse reference, instruction, optional media and quiz question association. Each unit has a globally unique ID and a unique `(version_id,ordinal)`. An ayah unit must have a canonical verse reference. A choice unit must have a corresponding question before publication.

`questions`: unit/version-linked prompt, server-only correct option ID and reviewed explanation. Options are structured JSON objects with IDs and display labels. The importer verifies 2–4 unique options, exactly one correct ID present, and no answer exposed in public DTOs. For a sound question, the required approved audio asset is attached to the unit.

`content_reviews`: immutable reviewer decisions and check results tied to the release hash. The reviewer must differ from the candidate author. Rejected/changed candidates require a new review against the new hash. `content_reports`: parent-submitted reason code and optional note, never child media attachments.

`curriculum_releases`: immutable structured stage/order/prerequisite configuration with author, distinct reviewer, status and checksum. This is a small JSON graph, not a recommendation engine. The publication service checks all referenced logical lessons have suitable published versions, validates a DAG and assigns a stable denominator for parent reports. Drafts can be created/edited through the content tools; review and publish use the same two-person discipline.

## 3. Learning records

`learning_sessions`: child ID, logical lesson ID, pinned version ID, server session status, randomized question presentation order, last sequence, last heartbeat, active-time estimate and timestamps. Statuses: active, paused, completed, replaced, expired or recalled. Only one writable active/paused session per child is allowed; opening a second requires explicit parent-gated replacement. A session is resumable for 24 hours from creation; after that, accepted progress remains and a new session is created.

`learning_events`: append-only event ID, session ID, child ID, sequence, event type, permitted payload, payload hash, server timestamp and optional bounded client timestamp. Session and child are linked with a composite foreign key. Event IDs are globally unique. The server's stored result is reused for identical replays.

`session_units`: one row per completed required unit within a session. Unit completion has a unique session/unit key. It must reference a unit in the session's pinned version. This row is an operational projection, not a claim of educational mastery.

`first_answers`: one first accepted response per session/question, selected option ID, correctness and server time. A later retry is a separate event but never overwrites first-answer correctness. Question/session/version matching is checked within the transaction; do not rely on client order alone.

`lesson_progress`: one row per child/logical lesson with first completion, latest practice time and current resume reference. Completion history persists across versions. Current-version unit progress is based on compatible accepted units only; incompatible version changes display a new-practice state without deleting past completion/rewards.

`rewards`: one first-completion star per child/logical lesson. Unique `(child_id,lesson_id,reward_type)` is the final duplicate-award guard. No balance edits or purchases.

`parent_assessments`: child ID, parent ID, target surah reference, observation status and server timestamp. Append-only; latest record is the current observation. This table does not update automatic lesson completion.

`daily_activity`: child, local date, timezone snapshot, accepted active milliseconds and completed-session/answer counts. This is a rebuildable projection. Timezone changes apply to new sessions; old bucket dates retain the timezone used then. Parent reporting explains that historical days do not shift when settings change.

## 4. Operational records

`idempotency_records`: actor scope, method/path, key, request hash, HTTP result body/code and expiry. Use a unique scoped key, proposed 24-hour transport retention. No password/secret bodies may be stored here; auth/gate requests are excluded.

`jobs`: kind, actor/parent scope, validated payload, status, attempts, lease expiry, object result key and expiry. Jobs support imports, asset verification, exports and deletion. Do not store arbitrary shell commands or fetch URLs in payloads.

`audit_events`: privileged actor/action/object/outcome/request ID/time with redacted metadata. Never copy child profile fields, auth secrets, raw consent documents or support notes into audit metadata.

## 5. Critical transactions

### Create child

Verify adult auth + live gate + active family grant + approved eligibility policy. Lock parent row. Recheck active-child count <3. Insert child/profile settings and any required inherited consent linkage. Commit. No child record is created when assurance fails.

### Enter child mode

Check owned active child and effective consent. Lock session-control row. Set mode=child, active_child_id=selected ID, adult_gate_until=NULL. Commit. Return a minimal child-safe session DTO and purge parent query-cache data client-side.

### Start/resume learning

Verify active child, current consent, live content status and prerequisite access. Lock child's session-selection state. Resume the existing eligible active/paused session for the same lesson, or reject with SESSION_IN_USE if another exists. Pin content version at session creation. A unique partial index is the concurrency backstop.

### Accept event batch

Validate the entire batch shape first. Lock learning session. Check current ownership, consent, version/recall and session lease. Replayed IDs must have the same payload hash and original sequence; new sequence numbers must be contiguous after the last accepted sequence. Each unit must belong to the pinned version. Insert events and update unit/time projections atomically. Either all new events commit or none do; identical already-accepted events may be returned as replayed.

### Accept answer

Lock session, verify presented question and option membership. Create the first-answer record only if absent. For a duplicate identical event return original feedback; a new event for another answer is a practice retry. First response stays unchanged. An answer plus feedback acknowledgment completes its required unit; game rounds reuse this mechanism.

### Finish session

Lock session. Reject unless every required unit is acknowledged and required questions have first responses. Mark completed, update logical-lesson progress, create the unique first-completion reward and daily projection in one transaction. Replay returns the completed result without another star. Parent overrides never go through this completion transaction.

### Publish content

Lock candidate, source/asset dependencies and logical lesson/current release state. Recheck approved rights, checksums, distinct review and required references. Write published status and pointer atomically. Audit and enqueue delivery-cache invalidation after commit. Any failed check leaves the candidate unpublished.

## 6. Time accounting

A heartbeat is sent no more often than once every 15 seconds while the activity is visible and playing or recently interacted with. The first heartbeat establishes an anchor and adds no time. For subsequent heartbeats, increment by the smaller of the reported active interval, server elapsed time since the previous accepted heartbeat and 15,000 ms; clamp negative values to zero. Ignore time after a hidden/paused/inactive transition.

No client event can add more than 15 seconds. A unique heartbeat event ID and sequence prevents duplicate increments. The single writable session rule prevents multi-tab accumulation. Long gaps do not add their entire wall-clock duration. This still estimates activity, not attention; display it as an estimate.

## 7. History and retention

Detailed learning events and first-answer detail have a proposed 90-day retention; summaries, logical lesson progress, rewards and parent assessments remain while the profile is active. Before trimming detail, close/reconcile sessions and preserve the minimum aggregate used by parent reports. Historical accuracy on older dates is available as aggregates, not item-level answers.

Logs: proposed 14 days, security/audit events: proposed 180 days, export files: 24 hours, transport idempotency records: 24 hours, backup rotation: 30 days. These are configurable product defaults, not statements of legal retention periods. Consent-evidence retention and exceptions require a documented privacy-owner decision.

Deletion immediately suspends access and revokes sessions, then removes active profile records, assets/exports containing personal data and linked projections. Retained audit records must be de-identified where possible. Do not silently retain a full profile as “soft deleted” forever. The runbook specifies backup suppression on restore.

## 8. Reference DDL limitations and migration rules

Auth tables, row-level security policies, storage IAM and every cross-table publication invariant are not supplied as a turnkey production implementation. The runtime database role is not the migration owner; the browser has no DB credentials. Owner-scoped services and adversarial tests are mandatory. Adding RLS later is optional defense in depth, not a substitute for them.

Migrations must be forward-reviewed, reversible where possible, applied against disposable databases in CI, and tested with concurrent writes. Install the auth-generated schema first and add real foreign keys to auth-user/session IDs once its exact schema is known. Do not run the reference DDL blindly over an existing database.
