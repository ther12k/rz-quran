# Operations & Release Runbook

## 1. Environments and configuration

Keep local, test, staging and production isolated by database, storage bucket, secrets and content-provider environment. Staging uses synthetic family data unless a separately approved pilot process exists. Production rejects `DEMO_MODE=true` and test consent methods.

Select hosting/storage/email providers after checking costs, region, processor terms and reliability; no current provider price is asserted here. Application secrets belong in a secret manager. Client-visible config is limited to the app origin, non-sensitive release info and permitted feature flags.

Runtime process roles: web/static server, API and worker. Use a non-owner database login for API/worker. Migrations run with separate controlled credentials. Do not expose PostgreSQL or quarantine buckets publicly.

## 2. Local setup contract

Implementation must provide `.env.example`, `compose.yaml` for local PostgreSQL and optional local S3-compatible storage, seed commands that reject production, migrations and scripts described in the implementation guide. No real credentials or copyrighted content payload is shipped as a default seed.

Document the exact runtime versions actually tested. Do not tell a developer that `bun install`/`bun dev` works until those scripts exist and have been executed. The present package is documentation, not that runnable repository.

## 3. Release preflight

Confirm green unit/integration/E2E tests, owner-isolation checks, schema/migration tests, secret/dependency scans, lint/typecheck and production build. Review logs for PII. Check production flags, supported browser screenshots, Arabic rendering evidence, source/rights/reviewer sign-offs and legal gate configuration.

Ensure database snapshot/backup exists before a risky migration. Test migration against staging data shape. Prefer expand→migrate→contract changes over destructive schema replacement. Apply migrations before routing traffic only when compatible with the old application; otherwise coordinate maintenance explicitly.

## 4. Deployment and rollback

Build an immutable image/artifact from the pinned lockfile and tag it with the commit/release ID. Deploy to staging, run smoke checks, then deploy production with the approved method. Smoke: sign-in, gate, enter child, catalog, one approved audio playback, event write, finish and gated parent summary.

Rollback application artifacts if health/error thresholds fail and the schema remains backward-compatible. Do not automatically reverse destructive migrations. Content rollback selects a prior approved version through the publication service; it is separate from an application rollback. Record who decided and what evidence triggered the rollback.

## 5. Monitoring

Track availability, p95 latency, 5xx count/rate, DB pool saturation, worker backlog/age, audio-delivery failures, auth/gate failures, recalled-content hits and export/deletion lag. Log request IDs and route templates; never payloads or signed URLs.

Initial alert proposals: sustained error rate over 2% for five minutes; job older than its defined service target; backup failure; unusual gate failure spike; content verification failure or publication without expected evidence. Tune in pilot; alert numbers are operational proposals, not tested thresholds.

## 6. Backup and restore

Proposed targets: database RPO ≤24 hours and RTO ≤8 hours for pilot; tighten only when supported by the selected hosting plan and tested procedure. Use daily backups and, where available/approved, continuous recovery logs. Keep backup encryption and restricted access. Proposed backup retention 30 days subject to privacy review.

Before public launch, restore to an isolated environment, run schema/integrity checks, apply the deletion suppression ledger, verify family isolation and inspect content pointers. Never restore a backup directly to production and accidentally reactivate deleted profiles or old consent states. Record actual restore duration and latest recoverable timestamp; untested targets are not achieved SLOs.

## 7. Content incident / recall

Receive a parent report or reviewer finding; identify affected source/version/asset; pause publication; assess criticality with the content lead. For credible wrong-text/wrong-audio risk, recall the affected version while investigating. Invalidate content status/delivery caches; prevent new sessions and signed URLs; block writes to recalled sessions with safe UI.

Find dependent content, create a corrected candidate, rerun automated and human review, then publish a new version. Preserve immutable source/history evidence. Notify parents when appropriate using approved wording. Already served media cannot be erased remotely; do not promise otherwise.

## 8. Security/privacy incident

Limit exposure, revoke compromised tokens/credentials, preserve necessary redacted evidence and involve security/privacy owners. Identify affected data and users. Legal counsel determines reporting obligations and timing for the actual incident. Avoid speculative public claims.

Do not resume normal operation until the root cause is mitigated, regression tests are added and an owner approves recovery. Document impact, containment, residual risk and follow-up actions.

## 9. Worker behavior

Jobs have `queued/running/succeeded/failed/canceled` state, bounded retries, lease expiration and idempotent processing. Claim rows transactionally; another worker can reclaim expired leases. Proposed retries: three with exponential backoff for transient errors; validation/permission failures do not retry. Side effects are keyed to job ID.

Exports read scoped snapshots, write private encrypted objects and set a 24-hour expiry. Deletion jobs revoke access first and repeat safely. Imports/asset verification operate on registered quarantine object keys and approved adapters, never arbitrary shell commands or unrestricted remote URLs.

## 10. Withdrawal, deletion and export drill

Create two synthetic families. Export family A and confirm no B records, secrets or answer keys. Expire/reuse the link and verify denial. Withdraw one child's processing and confirm new learning events stop immediately. Delete the profile, run jobs and verify active tables/objects/caches removed. Restore an older backup in isolation and prove the suppression ledger prevents reappearance.

Record each step and real result. Consent-evidence/audit exceptions need a documented purpose and bounded retention; they cannot justify keeping the entire profile.

## 11. Source/provider outage

New imports may pause while published legally hosted assets continue. If runtime media is unavailable, show retry/unavailable state, preserve accepted progress and avoid fabricating replacements. Back off provider retries and keep secrets out of logs. Never switch reciter or corpus edition silently to hide an outage.

## 12. Maintenance

Review dependencies and provider changes regularly, pin tested updates, review source rights/expiry, audit staff roles, test restore on a schedule and check retention job health. Reassess privacy/legal policy when launching a new market, adding voice capture, changing age eligibility or introducing analytics/payments. Those changes are not simple feature toggles.
