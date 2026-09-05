// T062: post-restore verification. Runs against a RESTORED database copy and
// proves the suppression ledger catches profiles deleted before the backup,
// plus pointer/ownership integrity — before the restore may be declared a
// recovery. Exit 0 = verified; non-zero = DO NOT declare recovery.
import postgres from "postgres";

const dbUrl = process.argv[2];
if (!dbUrl) {
  console.error("usage: bun verify-restore.ts <DATABASE_URL_OF_RESTORED_COPY>");
  process.exit(1);
}

const sql = postgres(dbUrl, { max: 1 });

type Result = { check: string; ok: boolean; detail: string };
const results: Result[] = [];
const add = (check: string, ok: boolean, detail: string) => results.push({ check, ok, detail });

try {
  // 1. Schema/migration completeness
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
  const names = tables.map((t) => t.table_name as string);
  const required = ["user", "session", "children", "lesson_versions", "learning_sessions", "deletion_suppressions", "rate_limit_buckets", "audit_events"];
  const missing = required.filter((r) => !names.includes(r));
  add("schema.complete", missing.length === 0, missing.length === 0 ? `${names.length} tables present` : `missing: ${missing.join(",")}`);

  // 2. Suppression-ledger replay: children deleted pre-backup WILL reappear in
  //    the restored copy (the backup predates deletion or the deletion raced
  //    the dump). The ledger is the authority: every suppressed child that
  //    resurrected must be re-deleted here, before recovery is declared.
  const resurrected = await sql`
    SELECT c.id, c.nickname, s.suppressed_at
    FROM children c
    JOIN deletion_suppressions s ON s.scope = 'child' AND s.reference_key = c.id::text`;
  for (const row of resurrected) {
    // Re-apply deletion on the restored copy (same order as live deletion).
    await sql`UPDATE learning_sessions SET status='expired' WHERE child_id = ${row.id} AND status IN ('active','paused')`;
    await sql`UPDATE session_controls SET mode='parent', active_child_id=NULL WHERE active_child_id = ${row.id}`;
    await sql`DELETE FROM children WHERE id = ${row.id}`;
  }
  add(
    "suppression.replayed",
    true,
    `${resurrected.length} resurrected profile(s) re-deleted per ledger${resurrected.length ? `: ${resurrected.map((r) => r.nickname).join(", ")}` : " (none resurrected)"}`,
  );

  // 3. Ledger ↔ live consistency after replay: no suppressed child remains.
  const remaining = await sql`
    SELECT count(*)::int AS n FROM children c
    JOIN deletion_suppressions s ON s.scope='child' AND s.reference_key = c.id::text`;
  add("suppression.consistent", remaining[0].n === 0, remaining[0].n === 0 ? "no suppressed profiles remain" : `${remaining[0].n} suppressed profiles still present`);

  // 4. Content pointer integrity: every lesson's current version exists and is published.
  const orphans = await sql`
    SELECT count(*)::int AS n FROM lessons l
    LEFT JOIN lesson_versions v ON v.id = l.current_version_id AND v.status='published'
    WHERE l.current_version_id IS NOT NULL AND v.id IS NULL`;
  add("content.pointers", orphans[0].n === 0, orphans[0].n === 0 ? "current-version pointers intact" : `${orphans[0].n} broken pointers`);

  // 5. Ownership integrity: session_controls never point at another parent's child.
  const badOwnership = await sql`
    SELECT count(*)::int AS n FROM session_controls sc
    JOIN children c ON c.id = sc.active_child_id
    WHERE c.parent_id <> sc.parent_id`;
  add("ownership.sessions", badOwnership[0].n === 0, badOwnership[0].n === 0 ? "session ownership consistent" : `${badOwnership[0].n} cross-parent references`);

  // 6. Learning-event/child composite integrity (FK backstop held through restore).
  const orphansEvents = await sql`
    SELECT count(*)::int AS n FROM learning_events e
    LEFT JOIN learning_sessions s ON s.id = e.session_id AND s.child_id = e.child_id
    WHERE s.id IS NULL`;
  add("events.composite", orphansEvents[0].n === 0, orphansEvents[0].n === 0 ? "event/session/child links intact" : `${orphansEvents[0].n} orphan events`);
} catch (err) {
  add("fatal", false, (err as Error).message);
} finally {
  await sql.end();
}

console.log("\n=== Restore Verification (T062) ===");
for (const r of results) console.log(` [${r.ok ? "PASS" : "FAIL"}] ${r.check}: ${r.detail}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0 ? "\nRESTORE VERIFIED — safe to declare recovery." : "\nRESTORE NOT VERIFIED — do not declare recovery.");
process.exit(failed.length === 0 ? 0 : 1);
