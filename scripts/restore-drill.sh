#!/usr/bin/env bash
# T062: isolated restore + deletion-replay drill against the local stack.
#
# Exercises the REAL resurrection path end to end:
#   1. ensure a sacrificial child profile exists on the live DB
#   2. take the backup (child still present)
#   3. delete the child on live (suppression-ledger row written)
#   4. take a STANDALONE single-table ledger backup (the "next scheduled
#      ledger export" — an artifact independent of the full DB backup)
#   5. restore the pre-deletion backup into an isolated DB (child resurrects)
#   6. restore the standalone ledger artifact onto the recovered copy and
#      run verify-restore.ts: it must detect and re-delete the profile
# Measures dump/restore/read times (RTO components) and the RPO window.
set -euo pipefail

ADMIN_URL="${ADMIN_URL:-postgresql://rzq:local_only@127.0.0.1:5433/postgres}"
SRC_DB="${SRC_DB:-quran_kids}"
DRILL_DB="rzq_restore_drill_$(date +%s)"
STAMP="$(date +%Y-%m-%dT%H:%M:%S%z)"
OUT="evidence/restore-drill-$(date +%Y%m%d-%H%M%S).md"
SRC_URL="${ADMIN_URL%/postgres}/${SRC_DB}"

mkdir -p evidence /tmp/rzq-drill
echo "[$STAMP] T062 restore drill: source=${SRC_DB} target=${DRILL_DB}"

# --- 1. Sacrificial child (needs any existing parent on the dev DB) ----------
SACR_ID="deadbeef-0000-4000-8000-00000000c0de"
PARENT_ID="$(psql "$SRC_URL" -tAc "SELECT id FROM parents LIMIT 1" || true)"
SACRIFICIAL=1
if [ -z "${PARENT_ID// /}" ]; then
  SACRIFICIAL=0
  echo "no parent rows on source DB; running consistency-only drill"
else
  psql "$SRC_URL" -q <<SQL
INSERT INTO children (id, parent_id, nickname, avatar_key, age_band)
VALUES ('${SACR_ID}', '${PARENT_ID}', 'Drill Anak', 'leaf_mint', '5_7')
ON CONFLICT (id) DO NOTHING;
DELETE FROM deletion_suppressions WHERE reference_key = '${SACR_ID}';
SQL
fi

# --- RPO anchor ---------------------------------------------------------------
LAST_ROW_BEFORE="$(psql "$SRC_URL" -tAc \
  "SELECT coalesce(max(x)::text,'none') FROM (SELECT max(server_at) FROM learning_events UNION ALL SELECT max(recorded_at) FROM consent_records UNION ALL SELECT max(created_at) FROM audit_events) t(x)")"

# --- 2. Backup (RTO component 1; child still present) --------------------------
T0=$(date +%s%3N)
docker exec rzq-kids-db pg_dump -U rzq -Fc "$SRC_DB" > /tmp/rzq-drill/backup.dump
T1=$(date +%s%3N)
DUMP_MS=$((T1-T0)); DUMP_BYTES=$(stat -c%s /tmp/rzq-drill/backup.dump)

# --- 3. Live deletion AFTER the backup (ledger row survives on live) -----------
LEDGER_SNAPSHOT=/tmp/rzq-drill/live-suppressions.csv
if [ "$SACRIFICIAL" = "1" ]; then
  psql "$SRC_URL" -q <<SQL
UPDATE learning_sessions SET status='expired' WHERE child_id='${SACR_ID}' AND status IN ('active','paused');
UPDATE session_controls SET mode='parent', active_child_id=NULL WHERE active_child_id='${SACR_ID}';
INSERT INTO deletion_suppressions (id, scope, reference_key, reason, requested_by)
VALUES ('cafe0000-0000-4000-8000-00000000c0de', 'child', '${SACR_ID}', 'parent_request', '${PARENT_ID}')
ON CONFLICT (id) DO NOTHING;
DELETE FROM children WHERE id='${SACR_ID}';
SQL
fi
psql "$SRC_URL" -tAc "SELECT id||'|'||scope||'|'||reference_key||'|'||reason||'|'||requested_by FROM deletion_suppressions" > "$LEDGER_SNAPSHOT"

# --- 3.5 Standalone ledger artifact (independent of the full backup) ------------
# Models the scheduled off-database ledger export: recoverable even if the
# primary environment is lost, and re-appliable onto any restored copy.
LEDGER_DUMP=/tmp/rzq-drill/ledger.dump
docker exec rzq-kids-db pg_dump -U rzq -Fc --table deletion_suppressions "$SRC_DB" > "$LEDGER_DUMP"
LEDGER_DUMP_BYTES=$(stat -c%s "$LEDGER_DUMP")

# Dataset scale (defines what the measured timings cover)
SCALE="$(psql "$SRC_URL" -tAc "SELECT 'children='||(SELECT count(*) FROM children)||' events='||(SELECT count(*) FROM learning_events)||' versions='||(SELECT count(*) FROM lesson_versions)||' ledger='||(SELECT count(*) FROM deletion_suppressions)")"

# --- 4. Restore the pre-deletion backup into an isolated DB --------------------
psql "$ADMIN_URL" -c "CREATE DATABASE \"${DRILL_DB}\"" >/dev/null
T2=$(date +%s%3N)
docker exec -i rzq-kids-db pg_restore -U rzq -d "$DRILL_DB" --no-owner < /tmp/rzq-drill/backup.dump
T3=$(date +%s%3N)
RESTORE_MS=$((T3-T2))
DRILL_URL="${ADMIN_URL%/postgres}/${DRILL_DB}"

RESURRECTED_COUNT="$(psql "$DRILL_URL" -tAc "SELECT count(*) FROM children WHERE id='${SACR_ID}'")"

# --- 5. Restore the standalone ledger artifact onto the recovered copy ----------
# The artifact is the authoritative post-deletion ledger; replace the
# recovered (stale, pre-deletion) ledger with it, then verify replay.
psql "$DRILL_URL" -q -c "TRUNCATE deletion_suppressions"
docker exec -i rzq-kids-db pg_restore -U rzq -d "$DRILL_DB" --no-owner --data-only --table deletion_suppressions < "$LEDGER_DUMP"
LEDGER_RESTORED_COUNT="$(psql "$DRILL_URL" -tAc "SELECT count(*) FROM deletion_suppressions")"

# --- 6. Verification + suppression replay on the restored copy ------------------
if OUTPUT="$(bun packages/database/src/verify-restore.ts "$DRILL_URL" 2>&1)"; then
  VERIFY=PASS
else
  VERIFY=FAIL
fi

# --- Post-restore smoke read (RTO component 3) ----------------------------------
T4=$(date +%s%3N)
FIRST_READ="$(psql "$DRILL_URL" -tAc "SELECT count(*) FROM lesson_versions WHERE status='published'")"
T5=$(date +%s%3N)
SMOKE_MS=$((T5-T4))

RTO_TOTAL_MS=$((T1-T0 + T3-T2 + T5-T4))
POST_LEDGER_COUNT="$(psql "$DRILL_URL" -tAc "SELECT count(*) FROM children WHERE id='${SACR_ID}'")"

# --- Report ----------------------------------------------------------------------
{
  echo "# Restore & Deletion-Replay Drill (T062)"
  echo ""
  echo "- **Date:** ${STAMP}"
  echo "- **Scope:** local isolated drill (docker PostgreSQL 16; \`${SRC_DB}\` → \`${DRILL_DB}\`)"
  echo "- **Dataset scale:** ${SCALE}"
  echo "- **Backup:** ${DUMP_BYTES} bytes (custom format, pre-deletion)"
  echo "- **Independent ledger artifact:** single-table pg_dump, ${LEDGER_DUMP_BYTES} bytes (post-deletion export); restored standalone into the recovered copy; ${LEDGER_RESTORED_COUNT} suppression row(s) applied from the artifact"
  echo "- **Resurrection exercised:** ${SACRIFICIAL}; resurrected in restored copy: ${RESURRECTED_COUNT}; remaining after ledger replay: ${POST_LEDGER_COUNT}"
  echo "- **Measured RTO (local scale):** dump ${DUMP_MS} ms + restore ${RESTORE_MS} ms + first verified read ${SMOKE_MS} ms = **${RTO_TOTAL_MS} ms**"
  echo "  - Timer boundaries: pg_dump start → pg_restore end → first verified SQL read. Excludes container provisioning, network/DNS, app process restart and full service-level smoke."
  echo "- **RPO:** bounded by backup schedule; last pre-dump row: ${LAST_ROW_BEFORE}"
  echo "- **Verification:** ${VERIFY}"
  echo ""
  echo '```'
  echo "$OUTPUT"
  echo '```'
  echo ""
  echo "_Local-scale drill evidence. Honest limits: artifacts live on the same host as the database (off-site copy requires real infrastructure, not authorized in this environment); recovery verification is SQL-level, not a full end-to-end service drill; production-scale drill re-runs post-D09._"
} > "$OUT"

# --- Cleanup (drop drill DB; ledger row on live remains as drill evidence) ------
psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS \"${DRILL_DB}\"" >/dev/null

echo "Wrote $OUT"
[ "$VERIFY" = "PASS" ]
