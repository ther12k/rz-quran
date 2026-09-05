# Eligibility, Consent & Retention Decision Register

**Task:** T003 · **Date:** 2026-09-05 · **Owner:** Product + Privacy/Legal  
**Status:** Documented · **Requirements:** FR-01, FR-02, FR-15

## 1. Decision Ownership & Open Approvals

| Decision ID | Area | Proposed Baseline | Assigned Owner | Launch Blocker? | Current Status |
| --- | --- | --- | --- | --- | --- |
| **D02** | Launch markets & age/eligibility | Indonesia-first supervised pilot; age bands 5–7 and 8–10 | Product Owner + Legal Lead | **Yes (Blocks public launch)** | Proposed default implemented with non-production validation. Real child enrollment blocked in production. |
| **D03** | Parental authority & consent assurance | Server-validated assurance token; Indonesian PDP 2026 framework compliance | Privacy/Legal Counsel | **Yes (Blocks public enrollment)** | Non-production demo assurance mechanism (`demo_local_nonproduction`) active in development/test. Production fails closed with `ELIGIBILITY_BLOCKED`. |
| **D09** | Hosting, database, storage & email processor region | Managed PostgreSQL, local/regional S3-compatible private bucket, TLS termination in Indonesia/Singapore | Operations Lead + Privacy Counsel | **Yes (Blocks deployment)** | Local development environment uses Docker PostgreSQL (:5433); production environment verification tests fail closed if unapproved/loopback hosts configured. |
| **D10** | Data retention and deletion exceptions | 90-day learning event retention, active parent summary retention, 24h export expiry, 14-day logs, 30-day backup rotation | Legal Lead + Engineering Lead | **Yes (Blocks public launch)** | Default retention periods specified in schema constraints and documented in runbook. |

## 2. Hard Invariant: Production Child Enrollment Blocked
As implemented in `apps/api/src/env.ts` and verified by automated unit tests in `tests/unit/env.test.ts`:
- If `APP_ENV=production`, the application refuses to boot if `DEMO_MODE=true`.
- If `PRODUCTION_CHILD_ENROLLMENT_ENABLED=false` (the default), child profile creation is completely disabled in production.
- If `PRODUCTION_CHILD_ENROLLMENT_ENABLED=true` is asserted in production without specifying both `APPROVED_PRIVACY_POLICY_VERSION` and `APPROVED_CONSENT_METHOD`, the API fails closed during the readiness preflight check.
- Neither an adult email/password account nor passing the 5-minute parent gate constitutes legal parental consent under applicable personal data protection laws.
