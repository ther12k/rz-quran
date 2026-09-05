// API entrypoint: one Bun/Elysia modular monolith serving /api/auth/* (Better
// Auth) and /api/v1/* (domain routes) plus health/readiness.
import { Elysia } from "elysia";
import { createDatabase } from "@rzq/database";
import { createAuth, type Auth, type AuthHooks } from "./auth.ts";
import { loadEnv, productionReadinessViolations, parseEnv, consentPolicy, type AppEnv } from "./env.ts";
import { ApiError } from "./errors.ts";
import { identityModule } from "./modules/identity.ts";
import { familiesModule } from "./modules/families.ts";
import { learningModule } from "./modules/learning.ts";
import { reportingModule } from "./modules/reporting.ts";
import { adminModule } from "./modules/admin.ts";
import { privacyModule } from "./modules/privacy.ts";
import type { AppBindings } from "./modules/context.ts";
import type { Database } from "@rzq/database";

export type App = ReturnType<typeof buildApp>;

export function buildApp(
  envOverride?: Partial<AppEnv>,
  envVars?: Record<string, string | undefined>,
  hooks?: AuthHooks,
) {
  const env: AppEnv = envOverride
    ? ({ ...loadEnv(), ...envOverride } as AppEnv)
    : envVars
      ? parseEnv(envVars)
      : loadEnv();

  const violations = productionReadinessViolations(env);
  if (violations.length > 0) {
    throw new Error(`Refusing to boot (production safety):\n- ${violations.join("\n- ")}`);
  }

  const db: Database = createDatabase(env.databaseUrl);
  const auth: Auth = createAuth(env, db, hooks);

  let currentRequestId = crypto.randomUUID();

  const bindings = (): AppBindings => ({
    auth,
    db,
    consentPolicy: consentPolicy(env),
    requestId: currentRequestId,
  });

  const app = new Elysia()
    .onRequest(() => {
      currentRequestId = crypto.randomUUID();
    })
    .onError(({ error, set }) => {
      if (error instanceof ApiError) {
        set.status = error.status;
        return {
          error: { code: error.code, message: error.message, request_id: currentRequestId, details: error.details },
        };
      }
      // Elysia framework errors (NotFoundError, ValidationError, ...) carry an
      // HTTP status; surface it instead of masking 404/422 as 500.
      const httpStatus = (error as { status?: unknown }).status;
      if (typeof httpStatus === "number" && httpStatus >= 400 && httpStatus < 500) {
        set.status = httpStatus;
        const code = (error as { code?: unknown }).code;
        return {
          error: {
            code: typeof code === "string" && code ? code : "HTTP_ERROR",
            message: "Permintaan tidak dikenal atau tidak valid.",
            request_id: currentRequestId,
          },
        };
      }
      console.error("[api] unhandled error", error);
      set.status = 500;
      return {
        error: {
          code: "INTERNAL_ERROR",
          message: "Terjadi kesalahan. Silakan coba lagi.",
          request_id: currentRequestId,
        },
      };
    })
    .get("/healthz", () => ({ status: "ok" }))
    .get("/readyz", async () => {
      try {
        await db.execute("select 1");
        return { status: "ready" };
      } catch {
        return new Response(JSON.stringify({ status: "unavailable" }), { status: 503 });
      }
    })
    .use(identityModule(bindings))
    .use(familiesModule(bindings))
    .use(learningModule(bindings))
    .use(reportingModule(bindings))
    .use(adminModule(bindings))
    .use(privacyModule(bindings));

  return { app, env, db, auth, bindings };
}

const isMain = import.meta.main;
if (isMain) {
  const { app, env } = buildApp();
  Bun.serve({
    port: env.apiPort,
    fetch: app.fetch,
  });
  console.log(`[api] listening on http://localhost:${env.apiPort} (APP_ENV=${env.appEnv}, demo=${env.demoMode})`);
}
