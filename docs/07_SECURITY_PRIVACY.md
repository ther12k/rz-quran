# Security, Child Safety & Privacy Readiness

This is a product/engineering control specification, **not a legal opinion or a compliance certification**. A privacy owner and qualified legal adviser must determine requirements for the intended deployment, users, data flows and jurisdictions before collecting real child data.

## 1. Jurisdiction gate

Indonesia-first planning must review the personal-data law, PP 17/2025 on child protection in electronic systems and the 2026 implementing regulation listed in the source register [S07–S09]. That review must resolve applicable age/risk classification, eligibility, parental authority/consent assurance, notices, retention, processor relationships and reporting obligations. Merely calling the product “educational” does not resolve those questions.

Any availability to US children needs a COPPA applicability and consent review against the current rule [S10]; other markets require their own review. The default specification does not authorize worldwide launch. Do not add invasive identity collection as an improvised answer to regulatory uncertainty.

Public production eligibility remains disabled until a named owner records the approved policy and mechanism. Development can use synthetic adult/child records and marked test consent. The production server must reject that test mechanism.

## 2. Data inventory and purpose

| Data | Why | Default handling |
| --- | --- | --- |
| Adult email, password hash and auth sessions | Adult access/recovery | Auth library and secured auth store; no child credentials |
| Nickname, curated avatar, age band | Child presentation and stage selection | Parent-owned; no public search/profile |
| Learning sessions, answers and summaries | Resume and parent reporting | Scoped records; detailed retention limited |
| Parent observations | Guided memorization practice | Clearly parent-authored, private, timestamped |
| Consent/assurance evidence reference | Record approved processing decisions | Minimal metadata; no raw ID documents in learning DB |
| Parent support note | Resolve a problem | Optional, short, access-limited, redact logs |
| Operational request metadata | Reliability/security | Redacted, bounded retention; no payload recording |
| Reviewed curriculum/source data | Deliver learning content | Separate from personal data; source rights tracked |

Do not collect child email, phone, exact birthdate by default, location, school, voice, photo, contact list, advertising identifier or unstructured child messages. The app does not request microphone/camera permission in MVP. A legal review changing this policy requires a new data-impact assessment and explicit scope decision.

## 3. Child-safe defaults

No advertising, external tracking pixels, session replay, social graph, public leaderboard, chat, payments or outbound child-facing hyperlinks. No manipulative streak-loss messaging. Start lesson audio only after a tap. Separate decorative sounds from recitation controls. Offer breaks and a safe stop action.

Profiles use curated avatars. No public UGC ingestion or content sharing. Support is parent-only. Do not leak a parent's name/email in child UI, error details, analytics events or view-source fixtures.

## 4. Threat model

| Threat | Control | Required proof |
| --- | --- | --- |
| Parent A reads/writes child B | Scoped authorization + composite constraints | Cross-parent API tests for every private route |
| Child bypasses adult gate | Server session mode + recent-auth predicate | Direct API, back-button and mounted-auth-route tests |
| Quiz answers exposed before submission | Explicit public serializers | Snapshot/contract test for forbidden fields |
| Replayed requests inflate progress | Event IDs, sequence, locks and reward uniqueness | Duplicate/concurrent finish tests |
| Forged client time inflates duration | Server-capped heartbeats and one writable session | Idle/background/concurrency tests |
| Editor publishes incorrect/unlicensed content | Distinct review, immutable hash, rights checks | Negative publication tests and human evidence |
| Imported URL accesses internal services | Allowlisted adapter, no arbitrary URL fetch | SSRF/redirect/private-address tests |
| Malicious uploaded file | Private quarantine, MIME/size/decoder checks | Rejected invalid media and archive-path tests |
| Export URL leaks child data | Owner gate, expiring object, no-store | Other-parent and expired-link tests |
| Source/secret leaks via frontend/logs | Server-only credentials, redaction, secret scans | Build and log inspection |
| Deleted data returns after restore | Deletion suppression ledger/runbook | Restore-and-reapply-deletion drill |

The object-authorization control addresses the failure class described by OWASP [S06]. A random-looking ID never authorizes access.

## 5. Authentication and privileged actions

Use a maintained adult-auth implementation; do not roll password hashing, reset tokens or session cryptography. Require email verification, a clear recovery process and revocation support. Staff MFA and provisioned role checks are release gates. Retain no plaintext password in logs, request snapshots, jobs or idempotency rows.

Parent gate lasts five minutes and is cleared on entry to child mode, logout, password/email change or session revocation. Every parent endpoint and sensitive auth-provider route checks the gate. Any local “unlocked=true” flag is presentation state only.

One selected child is bound to the server-controlled browser session. A malicious child ID in a URL/body cannot change that context. Do not implement staff impersonation of families in the MVP.

## 6. Application and infrastructure controls

HTTPS; HTTP-only/Secure/SameSite cookies as appropriate; origin and CSRF validation; restrictive content security policy; clickjacking protection; no permissive cross-origin credentials; SQL parameterization; JSON body limits; explicit serializers; upload allowlist; secure object-storage access and least-privilege runtime DB roles.

CSP must account for the actual hosted font/illustration/audio sources; prefer controlled origins. Avoid arbitrary third-party embeds and remote scripts. Disable verbose production errors. Rate limits must work across replicas, not only within one process.

No direct client access to PostgreSQL. Separate migration credentials from runtime credentials. Optional RLS is a future defense-in-depth choice; this specification does not claim it has been supplied or tested. Maintain adversarial service-level authorization tests regardless.

## 7. Consent, withdrawal and eligibility

Store versioned purpose/notice/policy and the assurance method/evidence reference produced by the approved flow. A family grant is required; per-child withdrawal can block an individual profile. Do not substitute verified email, a math puzzle, a password gate or an unchecked checkbox for legal analysis of valid parental authority and consent.

On withdrawal, immediately suspend relevant child access, revoke learning sessions and stop writes. Explain whether withdrawal also requests deletion; offer a separate clearly stated delete action. Reconsent requires the approved mechanism and current notice. Pending eligibility allows only adult setup/support, not real child tracking.

## 8. Proposed retention and deletion policy

Engineering defaults, subject to privacy approval: 90 days detailed learning activity; ongoing profile summaries until deletion; 14 days operational logs; 180 days redacted security/admin audit; 24 hours export files and transport idempotency snapshots; 30 days rotating backups. Do not call these statutory periods.

Deletion flow: confirm with fresh parent gate → mark deletion_pending and revoke access immediately → durable job deletes active records, private exports and linked objects → retain only separately justified, minimized evidence → record completion → remove or expire backup copies through the approved backup lifecycle. Target active-store processing within seven days as an internal service goal, not a legal assertion.

Maintain a minimal deletion suppression ledger outside regular restored datasets, with retention tied to backup horizon, to prevent resurrecting deleted records after restore. It must contain only the identifiers needed to reapply deletion, not whole profiles. Delete it after the approved suppression need expires.

## 9. Export

Export parent-owned records to JSON with a schema/version explanation: profile fields, settings, consent actions, progress summaries, recent detailed history and parent assessments. Exclude password hashes, session tokens, correct-answer keys, other families, internal security logs and private licensing evidence.

The export job returns an opaque status ID, not a public bucket path. A download is gated to the requesting owner, expires in 24 hours, and uses a short-lived signed link or streamed authenticated response. Parent consent to processing is not consent to external analytics or model training.

## 10. Logs, metrics and support

Log request ID, route template, coarse outcome/latency and pseudonymous operational actor where necessary. Never log raw request bodies for auth, assessment, support, progress or canonical content responses. Redact email, nickname, token, signed URL and arbitrary note text.

No third-party child behavior SDK. Product learning metrics derive from the operational data model. Any aggregate pilot reporting has a documented purpose and approval; a cohort threshold alone does not mathematically guarantee anonymity.

## 11. Incident response

Engineering owner contains the incident, preserves minimally necessary evidence, revokes compromised credentials/sessions and determines affected scope with the privacy owner. Content errors have a dedicated recall path; security incidents use the broader response runbook. Legal counsel determines notification obligations and deadlines for actual circumstances. Do not invent a universal notification clock in code/docs.

Re-enable service only after the trigger is fixed, tests cover the failure and the responsible owner signs off. Communicate accurately; do not label an uninvestigated alert a confirmed breach or claim no exposure without evidence.

## 12. Release checklist

Named privacy and security owners; approved market/age/risk/consent policy; processor and storage decisions; data inventory; notice and retention schedule; child/parent isolation tests; staff MFA; third-party network audit; export/deletion/restore drills; incident contacts; approved production assets and no demo bypass. Public launch is blocked until evidence exists for every applicable item.
