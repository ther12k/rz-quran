# Database Reference

`domain-reference.sql` is a PostgreSQL domain design, not a ready-to-deploy database application. It deliberately does not guess the auth library's table names, schema version or credentials.

Before production, generate the pinned auth schema, add actual user/session foreign keys, translate this domain model into reviewed Drizzle migrations, enforce server authorization, and test constraints/transactions against PostgreSQL. No RLS policy is claimed to be included. Runtime credentials must not be the migration owner and must never reach the browser.

The schema supplies explicit composite ownership/version constraints, event/sequence uniqueness, first-answer uniqueness, one writable learning session per child, first-completion reward uniqueness and a canonical-text immutability backstop. These do not cover every business invariant. Option membership, source-array references, consent policy, parent gate, publication/review separation across tables, stage DAG checks and published-unit immutability require tested services and additional database backstops where practical.

Clear or revoke `session_controls` before deleting a selected child. Detailed activity retention must clear expired resume references and preserve needed summaries before deleting event/session detail. Never delete canonical text to “correct” it; import a new source release and retire/recall dependent content.

The minimized deletion suppression ledger is intentionally a deployment/retention concern outside the ordinary restored database. Implement and approve it before claiming deletion survives backup restore. The schema contains no real parents, children, licensed recitations or approved Quran corpus.
