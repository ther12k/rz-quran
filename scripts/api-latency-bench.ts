// T059: API latency benchmark on the local stack.
// Measures p50/p95/p99 for ordinary authenticated reads at concurrent load,
// per PRD §3 target (p95 < 500ms at 50 concurrent sessions, excluding media).
import postgres from "postgres";

const API = process.env.API_BASE_URL ?? "http://localhost:3310";
const CONCURRENCY = Number(process.env.BENCH_CONCURRENCY ?? 50);
const SAMPLES = Number(process.env.BENCH_SAMPLES ?? 300);

const password = "kata-sandi-aman-123";

async function createSessionAndCookie(): Promise<{ cookie: string }> {
  const email = `bench-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const signup = await fetch(`${API}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5181" },
    body: JSON.stringify({ name: "Bench Parent", email, password }),
  });
  if (!signup.ok) throw new Error(`signup failed: ${signup.status}`);

  const sql = postgres(process.env.DATABASE_URL ?? "postgresql://rzq:local_only@127.0.0.1:5433/quran_kids", { max: 1 });
  await sql`UPDATE "user" SET email_verified = true WHERE email = ${email}`;
  await sql.end();

  const signin = await fetch(`${API}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5181" },
    body: JSON.stringify({ email, password }),
  });
  if (!signin.ok) throw new Error(`signin failed: ${signin.status}`);
  const cookie = (signin.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .filter((c) => c.includes("session_token"))
    .join("; ");
  return { cookie };
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

async function main() {
  console.log(`Warming ${CONCURRENCY} sessions...`);
  const sessions = await Promise.all(Array.from({ length: CONCURRENCY }, () => createSessionAndCookie()));
  console.log("Sessions ready. Running benchmark...");

  const samples: number[] = [];
  let errors = 0;
  let cursor = 0;

  async function worker() {
    while (samples.length + errors < SAMPLES) {
      const { cookie } = sessions[cursor++ % sessions.length]!;
      const t0 = performance.now();
      try {
        const res = await fetch(`${API}/api/v1/me`, {
          headers: { Cookie: cookie, Origin: "http://localhost:5181" },
        });
        if (!res.ok) errors++;
        await res.arrayBuffer();
      } catch {
        errors++;
      }
      samples.push(performance.now() - t0);
    }
  }

  const t0 = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const wallMs = performance.now() - t0;

  samples.sort((a, b) => a - b);
  const report = {
    measured_at: new Date().toISOString(),
    environment: {
      api: `local Bun/Elysia (bun 1.4.0) on linux x64 (host dev machine)`,
      database: "local PostgreSQL 16 (docker, same host) — not production infra",
      endpoint: "GET /api/v1/me (authenticated read)",
      concurrency: CONCURRENCY,
      total_samples: samples.length,
      errors,
    },
    measured: {
      p50_ms: Math.round(percentile(samples, 50)),
      p95_ms: Math.round(percentile(samples, 95)),
      p99_ms: Math.round(percentile(samples, 99)),
      max_ms: Math.round(samples[samples.length - 1]!),
      wall_seconds: Number((wallMs / 1000).toFixed(2)),
      throughput_rps: Number((samples.length / (wallMs / 1000)).toFixed(1)),
    },
  };

  console.log(JSON.stringify(report.measured, null, 2));
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir("evidence", { recursive: true });
  await writeFile("evidence/perf-api-latency.json", JSON.stringify(report, null, 2));
  console.log("Report written to evidence/perf-api-latency.json");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
