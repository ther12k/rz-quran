# RZ Qur'an Kids

A mobile-first, Indonesian-language Qur'an learning experience for children, with a separate parent area and a small content-management workspace. **Working name, not a confirmed brand.** This is the children's learning product from the RZ-Quran-Kids handoff — *not* the separate AI Fiqh chatbot.

> **Status: M0–M4 implemented and tested; M5 tooling delivered. Public launch blocked on human approvals.** This repository contains no deployed product, no licensed recitation library, no approved curriculum and no legal sign-off. All learning content is clearly marked non-production demo fixture data (Hijaiyah letters only, no Qur'an verse text, no audio). **Public launch stays blocked** until content-rights, curriculum and privacy approvals are recorded (see `docs/11_DECISIONS_AND_OPEN_QUESTIONS.md`). Nothing in this repo should be read as a claim of educational efficacy or legal compliance.

## Milestone status (2026-09-05)

| Milestone | Issues | State |
| --- | --- | --- |
| M0 Foundations | 10/10 closed | Repo assessment, compatibility record, threat model, tokens, contracts, migrations, guarded fixtures, CI |
| M1 Safe slice | 15/15 closed | Auth, gate/child-mode, consent, profiles, learning engine, parent report, E2E + responsive screenshots |
| M2 Learning experience | 17/17 closed | Catalog search/filters, DAG stages, audio controller, media delivery, 5 short surahs (Tanzil text), quiz + sound game, assessments, comfort settings |
| M3 Content operations | 11/11 closed | Source/rights registry, asset quarantine + worker, two-person review (self-review blocked), release hashing, instant recall, content reports, audit trail, admin UI |
| M4 Privacy & hardening | 10 closed / 3 open | Withdrawal, export, deletion + suppression ledger, rate limiting, service worker, a11y/Arabic verification. Open: T059 (field perf), T060 (CI scans), T062 (restore drill) — need real environments |
| M5 Pilot & launch | 1 closed / 7 open | Preflight tooling closed (T069). Open: T063–T067, T070 — external human approvals (rights, curriculum, privacy, usability pilot, release sign-off), each documented on its issue |

Full regression (all green): typecheck · 9 contracts · 7 unit · 10 integration · 8 security · web build 99.77 KB gzip · 12 Playwright tests.

## What works right now (evidence-backed)

Implemented and tested against a real local PostgreSQL:

- **Adult authentication** (Better Auth 1.7.2, email + password) with required email verification — unverified adults cannot create child profiles.
- **Server-enforced parent gate** (5-minute, password reauthentication) and **child mode**: parent APIs fail in child mode even with a valid adult cookie; mounted auth account-mutation routes are allowlist-guarded in child mode.
- **Consent state machine**: demo assurance works only in local/test (`DEMO_MODE`); production fails closed (`ELIGIBILITY_BLOCKED`) until an approved policy is configured. A gate or checkbox is never treated as legal consent.
- **Child profiles** (max 3, race-safe), owner-scoped everywhere; cross-parent access by ID substitution returns 404.
- **One published demo Hijaiyah lesson** (`demo_only`, letters ب and ا plus one recognition question, no audio → honest unavailable state).
- **Learning sessions**: version-pinned, one writable session per child, ordered idempotent events (replays reuse stored results; sequence gaps conflict), server-scored first answers, completion requiring all required units, single first-completion star.
- **Parent progress report** from real aggregates with denominators, weekly chart + table and honest zero states.
- React web app: public landing (the eight benefits), sign-up/sign-in, consent + child onboarding, child home with bottom tabs, lesson player, gate, parent dashboard.

Test suites (all passing on 2026-09-05, PostgreSQL 16 in Docker): 9 contract, 7 unit, 2 integration (full journey E2E), 8 security (isolation/bypass/replay). Run them with the commands below.

## Stack (pinned in `bun.lock`)

| Layer | Choice | Tested version |
| --- | --- | --- |
| Runtime | Bun | 1.4.0 |
| API | Elysia | 1.4.30 |
| Auth | Better Auth (drizzle adapter) | 1.7.2 |
| Web | React + Vite + TypeScript | 19.1 / 7.1 |
| UI | Tailwind CSS (+ shadcn-style local primitives) | 4.1 |
| Data | PostgreSQL + Drizzle ORM / drizzle-kit | 16 / 0.44.7 / 0.31.10 |
| Validation | Zod | 3.25.76 |
| Tests | Vitest (+ Playwright planned) | 3.x |

No Next.js, no vector DB, no RAG/LLM, no Redis, no microservices.

## Repository layout

```
apps/
  web/            React SPA (child / parent areas, Indonesian copy)
  api/            Bun + Elysia modular monolith (identity, families, learning, reporting)
packages/
  database/       Drizzle schema, migrations, guarded demo seed
  contracts/      Zod DTO + authoring schemas mirroring contracts/
contracts/        Handoff OpenAPI 3.1 + JSON Schemas + examples (source of truth)
docs/             PRD, UX spec, architecture, data model, API guide, …
design/           Six concept mockups, tokens, screen inventory, copy baseline
database/         Reference DDL (design input, not runnable migrations)
tasks/            BACKLOG.md (74 P0 tasks, mirrored to GitHub issues)
tests/            contracts / unit / api (integration) / security
scripts/          backlog → GitHub issues importer
```

GitHub issues mirror `tasks/BACKLOG.md` one-to-one (T001–T074 → issues #1–#74) with milestones M0–M5 and labels `P0`, `in-progress`, `blocked-approvals`. Re-run `python3 scripts/import-backlog-issues.py` after adding backlog tasks (idempotent).

## Getting started (local development)

Requirements: Bun ≥ 1.4, Docker (or any PostgreSQL 16 you control).

```bash
# 1. Disposable local database (dedicated container; do not reuse other projects' DBs)
docker run -d --name rzq-kids-db \
  -e POSTGRES_USER=rzq -e POSTGRES_PASSWORD=local_only -e POSTGRES_DB=quran_kids \
  -p 127.0.0.1:5433:5432 postgres:16-alpine

# 2. Environment
cp .env.example .env
# generate a local secret:
sed -i "s/replace_with_generated_local_secret/$(openssl rand -hex 32)/" .env

# 3. Install, migrate, seed demo fixtures (letters only; refuses production/staging)
bun install
set -a; source .env; set +a
bun run db:migrate
bun run db:seed:demo

# 4. Run API (default port 3310) and web (5173, proxies /api same-origin)
bun run dev:api   # terminal 1
bun run dev:web   # terminal 2  → http://localhost:5173
```

Email verification in local dev is an honest stub: the verification URL is printed in the API log (no fake delivery claims). Paste it into the browser to verify, then sign in.

## Tests and checks

```bash
bun run test:contracts     # bundled positive/invalid examples + DTO invariants
bun run test:unit          # env/production-readiness fail-closed gates
bun run test:integration   # full journey on a disposable per-test database
bun run test:security      # ownership, gate, bypass, replay negatives
bun run typecheck          # tsc --noEmit for api + web
bun run check:production-readiness  # refuses demo mode / missing policy in prod config
```

Integration/security tests create and drop their own `rzq_test_*` databases on `127.0.0.1:5433`.

## Safety and content rules (non-negotiable)

- Child mode is enforced by the server, not by hidden links; ownership derives from session context, never client IDs.
- No fabricated Qur'an text, translations, recitations, or audio. Demo fixtures contain alphabet letters only; missing audio renders an honest unavailable state.
- No microphone/voice capture, no ads, no trackers, no chat, no payments, no public leaderboards.
- Completion ≠ memorization: only an explicit parent assessment may record a parent-observed status, and it is labeled as such.
- Answer keys, reviewer data and provider secrets stay server-side; public DTOs are validated to omit them.
- Production boot refuses `DEMO_MODE`, fixture publication and child enrollment without approved policy versions.

## Documentation

Start with `AGENTS.md` (precedence + working method), `docs/01_PRD.md`, `docs/02_UX_SPEC.md`, `docs/03_ARCHITECTURE.md`. The full handoff (contracts, data model, test plan, operations runbook, decision register) lives in `docs/` and `contracts/`. `reference/` PDF/DOCX copies from the handoff zip are intentionally not committed; the Markdown and machine contracts are the source of truth.

## License / rights

Not yet decided (handoff decision D12/D13 territory). The handoff documents and mockups in this repository come from the RZ-Quran-Kids-Handoff-v1.0 package; the six concept PNGs are design references only and must never be sliced into content assets.
