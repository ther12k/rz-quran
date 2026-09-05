# Threat Boundaries, Capabilities & Security Negative Matrix

**Task:** T010 · **Date:** 2026-09-05 · **Owner:** Security + Engineering  
**Status:** Completed · **Requirements:** FR-03, FR-13, FR-15

## 1. Capability & Role Matrix

| Capability | Trust Boundary | Prerequisite Server Checks | Permitted Surfaces | Denied Surfaces |
| --- | --- | --- | --- | --- |
| `public` | Anonymous client | None | `/healthz`, `/readyz`, `/`, `/masuk`, `/daftar` | Any personal or learning API |
| `adult_session` | Authenticated adult cookie | Valid session, `user.email_verified == true` | `/api/v1/me`, `/api/v1/parent/gate` | Any child learning session, staff tools |
| `parent_gate` | Adult session with recent re-auth | `adult_session` + `mode == parent` + `adult_gate_until > now()` (5 min) | Child profile CRUD, progress, consent ledger, export, deletion | Child learning routes, staff tools |
| `child_session` | Adult session in child mode | `mode == child` + active child selected + effective consent | `/catalog`, `/lessons/:id`, `/learning/*`, `/media/*` | All parent endpoints, auth mutations, export, delete |
| `staff_*` | Provisioned staff identity | Role capability in `staff_members` table + active session | `/admin/*` content endpoints | Family/child personal records, student impersonation |

## 2. Threat Cases & Verification Status

| Threat ID | Threat Vector | Defense Mechanism | Negative Test Coverage |
| --- | --- | --- | --- |
| **SEC-01** | Cross-parent child profile ID substitution | Scoped queries check `WHERE parent_id = ctx.parent.id` | Tested in `tests/security/isolation.test.ts` (returns 404) |
| **SEC-02** | Cross-parent progress/assessment access | Progress endpoint verifies parent ownership of child ID | Tested in `tests/security/isolation.test.ts` (returns 404) |
| **SEC-03** | Child-mode navigation to parent endpoints | Middleware rejects parent requests if `mode != 'parent'` or gate expired | Tested in `tests/security/isolation.test.ts` (returns 403 `PARENT_GATE_REQUIRED`) |
| **SEC-04** | Mounted auth route bypass in child mode | Explicit child-mode route allowlist blocks `/api/auth/update-user`, `/api/auth/change-password` | Tested in `tests/security/isolation.test.ts` (returns 403) |
| **SEC-05** | Parent gate expiration bypass | Server enforces timestamp `adult_gate_until > now()`, never trusts client flag | Tested in `tests/security/isolation.test.ts` (returns 403 on expired timestamp) |
| **SEC-06** | Answer key leakage to client | Public lesson & session DTOs explicitly omit `correct_option_id` and explanations | Tested in `tests/api/e2e-slice.test.ts` |
| **SEC-07** | Client event sequence replay & gaps | Transactional sequence check (`event.sequence == last_sequence + 1`) and payload hash check | Tested in `tests/api/e2e-slice.test.ts` and `isolation.test.ts` |
| **SEC-08** | Race condition in child limit | PostgreSQL row-level lock `SELECT id FROM parents WHERE id = $1 FOR UPDATE` before count check | Tested in `tests/security/isolation.test.ts` (4th profile rejected) |
| **SEC-09** | Replay of idempotency key with conflicting payload | Key stored with SHA-256 of request payload; conflict returns 409 `IDEMPOTENCY_CONFLICT` | Tested in `tests/security/isolation.test.ts` |
| **SEC-10** | Multiple writable sessions per child | PostgreSQL partial unique index `one_writable_session_per_child` on active/paused status | Tested in `tests/security/isolation.test.ts` |
