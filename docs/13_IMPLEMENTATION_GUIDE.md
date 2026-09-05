# Repository & Implementation Guide

## 1. Proposed workspace

```text
apps/
  web/src/
    app/                 routes, providers, mode guards
    features/            onboarding, child, learning, parent, admin
    components/          adapted shadcn primitives and learning controls
    audio/               single playback controller
    api/                 typed client and safe DTOs
    i18n/                Indonesian copy
  api/src/
    modules/             identity, families, content, learning, reporting
    policies/            mode, ownership, consent, staff capabilities
    repositories/        scoped database access
    jobs/                imports, media verification, export, deletion
    serializers/         explicit public/parent/staff DTOs
    index.ts
  worker/src/index.ts
packages/
  contracts/             validators and OpenAPI generation/consistency
  database/              Drizzle schema, migrations and fixtures
  config/                shared lint/TS settings
  ui/                    tokens and reusable accessible primitives
scripts/
tests/                   integration, e2e, contract, security
```

Do not create a packages directory for every component. The structure separates trust-sensitive concerns while keeping one deployable API codebase. Existing repositories may use equivalent structure after documenting the mapping.

## 2. Environment template contract

```dotenv
APP_ENV=development
APP_ORIGIN=http://localhost:5173
API_PORT=3000
DATABASE_URL=postgresql://app:local_only@localhost:5432/quran_kids
AUTH_SECRET=replace_with_generated_local_secret
AUTH_BASE_URL=http://localhost:5173
MAIL_FROM=
SMTP_URL=
STORAGE_ENDPOINT=
STORAGE_REGION=
STORAGE_BUCKET_PRIVATE=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
QF_CLIENT_ID=
QF_CLIENT_SECRET=
QF_ENV=prelive
CONTENT_PROVIDER=fixture
DEMO_MODE=true
PRODUCTION_CHILD_ENROLLMENT_ENABLED=false
APPROVED_PRIVACY_POLICY_VERSION=
APPROVED_CONSENT_METHOD=
```

This is a naming proposal, not working provider configuration. Select one auth-secret/base-URL naming adapter matching the chosen Better Auth version. Empty provider/email settings trigger honest local stubs or missing-service states, never leaked production credentials. Never put secrets under the `VITE_` namespace. Production boot must reject demo mode, fixture content publication and enabled child enrollment without approved policy settings.

## 3. Script contract to implement

`dev`, `build`, `lint`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `test:contracts`, `test:security`, `db:generate`, `db:migrate`, `db:seed:demo`, `worker`, `check:production-readiness`.

These script names are required future repository behavior, not commands already available in this documentation package. Document exact invocation once implemented. Demo seed requires an explicit non-production environment check.

## 4. Frontend implementation details

Use one application mode provider derived from `/me`, not local-storage identity. TanStack Query keys include the server-returned active child context; profile switches/logout purge family/private caches. Parent screens fetch only after gate verification and never retain sensitive cached views after mode changes.

Centralize audio in a controller with cancellation/generation tokens. Use route-aware cleanup and explicit lifecycle states. No audio inside uncontrolled per-card components. Answer submissions and heartbeats use a serial per-session mutation queue to preserve sequence. Pending state is visible and only server acknowledgments mark progress saved.

Use typed content DTOs to render lesson-type components. Do not put correct option IDs in HTML, JSON hydration, query caches or analytics. Server feedback may disclose the correct choice after submission for learning purposes, but that is distinct from shipping answer keys before the question is attempted.

Use native buttons/labels and accessible dialog primitives. Styling can change shadcn components substantially, but retain keyboard/focus semantics. Store copy keys separately; do not leave mixed “Quiz/Quis/Kuis” spellings across screens.

## 5. API implementation details

Handlers perform transport validation, resolve auth context and call a business service. Services enforce ownership/consent/mode and invariants. Repositories use parameterized scoped queries. Serializers construct whitelisted response shapes. Never return an ORM record as a child/public DTO automatically.

Auth integration must call the library's supported password verification/session APIs; do not query password hashes manually from an assumed schema. Maintain a tested child-mode allowlist around the mounted auth handler. Protect all staff operations with current capability and MFA checks.

The same completion service handles quiz and game sessions. Shared engine, different UX. Record first responses, retries and acknowledgments distinctly. Each effect that awards progress is transactionally guarded.

## 6. Testing and CI

Run schema/example validation before application tests. Use a disposable PostgreSQL database with actual migrations for service integration tests. Do not replace DB constraint/race tests with mocks. Use two parents and multiple children to test ownership. Use parallel finish requests to test idempotency.

Keep Playwright screenshot scenarios for all six reference directions plus missing screens: onboarding, gate, ayah player, privacy and admin review. Cover empty/error/recalled/offline states, not just happy screens. Attach actual screenshot results and known differences to reviews.

Run secret/dependency scans and a frontend bundle inspection for provider credentials/answer keys. Manual Arabic/keyboard/screen-reader review remains necessary. Do not label automatic tests “WCAG certified.”

## 7. Agent checkpoint format

```text
Milestone / task IDs:
Implemented behavior:
Changed files and migrations:
Commands run and results:
Screenshots / manual checks:
Unexecuted checks:
Open decisions / blockers:
Contract changes:
Next dependency-ready tasks:
```

Keep the checkpoint factual. A failure is useful evidence; hiding a failed test or relabeling a mock as production creates an unsafe handoff.
