# Runtime & Dependency Compatibility Record

**Task:** T002 · **Date:** 2026-09-05 · **Owner:** Engineering  
**Status:** Completed · **Requirements:** FR-01, FR-18

## 1. Verified Runtime Matrix

| Component | Tested Version | Lockfile / Pinned Spec | Verification Command & Result |
| --- | --- | --- | --- |
| **Bun** | 1.4.0 (34cbb9a40) | Native Linux x64 | `bun --version` → 1.4.0 |
| **Node / npm** | Node v22.23.2 | Optional host runtime | Tested inside Vitest runner |
| **TypeScript** | 5.9.3 | `typescript@^5.9.2` | `bun run typecheck` → 0 errors |
| **Elysia** | 1.4.30 | `elysia@^1.3.12` | Mounted routes, catch-alls, CORS, error handling |
| **Better Auth** | 1.7.2 | `better-auth@^1.7.2` | Drizzle adapter, scrypt verification, email verification |
| **Drizzle ORM** | 0.44.7 | `drizzle-orm@^0.44.2` | Schemas, relations, query builder, transactions |
| **Drizzle Kit** | 0.31.10 | `drizzle-kit@^0.31.4` | Generated clean SQL migrations 0000 & 0001 |
| **PostgreSQL** | 16.4-alpine | PostgreSQL 16 server | Verified in Docker container `rzq-kids-db` (:5433) |
| **postgres.js** | 3.4.9 | `postgres@^3.4.7` | Client connection pool, migrations, tests |
| **React** | 19.1.0 | `react@^19.1.0` | Server-safe controls, hooks, StrictMode |
| **React Router** | 7.9.1 | `react-router@^7.9.1` | Mode router, protected child/parent routes |
| **Vite** | 7.1.9 | `vite@^7.1.9` | Dev server, same-origin proxy, production bundle |
| **Tailwind CSS** | 4.1.13 | `@tailwindcss/vite@^4.1.13` | Custom tokens, 48px touch targets, Arabic styles |
| **Zod** | 3.25.76 | `zod@^3.25.76` | DTO and authoring schemas, contract validation |
| **Vitest** | 3.x | `vitest@^3` | Multi-project runner (unit, contracts, integration, security) |

## 2. Pinned Lockfile
- Committed as `bun.lock`.
- Reproducible workspace dependencies across `@rzq/web`, `@rzq/api`, `@rzq/database`, `@rzq/contracts`.

## 3. Notable Integration Discoveries & Resolutions
1. **Better Auth 1.7.2 Drizzle Adapter Schema**: Better Auth 1.7 requires an `issuer` column on the `account` table (`account.issuer text NOT NULL`). This was missing in earlier references and added in migration `0001_moaning_rafael_vega.sql`.
2. **Password Verification Function Signature**: `verifyPassword` exported from `better-auth/crypto` accepts `{ hash, password }` object arguments, not positional arguments.
3. **Stateless JWT Email Verification**: Better Auth 1.7 uses stateless JWT tokens rather than database-persisted verification rows. The email token was connected to test hooks via `onVerificationEmail` for reliable end-to-end testing without external email infrastructure.
4. **Bundle Performance Budget**: Web client build produces 94.56 KB gzipped JavaScript, well below the 250 KB target budget.
