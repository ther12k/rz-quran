// Production readiness gate for deployment pipelines (T061 subset).
// Exits non-zero when the configuration must not boot in production.
import { loadEnv, productionReadinessViolations } from "./env.ts";

const env = loadEnv();
const violations = productionReadinessViolations(env);
if (violations.length > 0) {
  console.error("PRODUCTION READINESS: FAIL");
  for (const v of violations) console.error(` - ${v}`);
  process.exit(1);
}
console.log("PRODUCTION READINESS: PASS (configuration-level checks only; release sign-off still required)");
