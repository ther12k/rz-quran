-- RZ Quran Kids: PostgreSQL domain-reference DDL, version 1.0.
-- Not a turnkey production schema or authorization layer.
-- Auth library tables and real auth FKs must be generated from the pinned version.
-- Translate into reviewed Drizzle migrations; test on disposable PostgreSQL first.
-- UUIDs are supplied by the application. No real user/content data is seeded.
BEGIN;

CREATE TABLE parents (
  id uuid PRIMARY KEY,
  auth_user_id text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  eligibility_status text NOT NULL DEFAULT 'pending'
    CHECK (eligibility_status IN ('pending','approved','blocked')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','deletion_pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_members (
  auth_user_id text PRIMARY KEY,
  capabilities text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (capabilities <@ ARRAY['content_editor','content_reviewer','content_publisher','ops_admin']::text[])
);

CREATE TABLE content_sources (
  id uuid PRIMARY KEY,
  source_kind text NOT NULL CHECK (source_kind IN
    ('quran_text','quran_audio','hijaiyah_audio','translation','illustration','lesson_notes')),
  title text NOT NULL,
  source_version text NOT NULL,
  upstream_reference text,
  acquired_at timestamptz NOT NULL,
  demo_only boolean NOT NULL DEFAULT false,
  rights_status text NOT NULL DEFAULT 'pending'
    CHECK (rights_status IN ('pending','approved','denied','revoked')),
  permitted_uses text[] NOT NULL DEFAULT '{}',
  license_reference text,
  attribution text NOT NULL DEFAULT '',
  evidence_object_key text,
  raw_object_key text,
  raw_sha256 text CHECK (raw_sha256 ~ '^[a-f0-9]{64}$'),
  registered_by text NOT NULL REFERENCES staff_members(auth_user_id),
  reviewed_by text REFERENCES staff_members(auth_user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (permitted_uses <@ ARRAY['display','streaming','redistribution','offline']::text[]),
  CHECK (reviewed_by IS NULL OR reviewed_by <> registered_by),
  CHECK (rights_status <> 'approved' OR
    (reviewed_by IS NOT NULL AND license_reference IS NOT NULL
     AND evidence_object_key IS NOT NULL AND raw_object_key IS NOT NULL AND raw_sha256 IS NOT NULL))
);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES content_sources(id),
  object_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('audio','image','source_file')),
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  sha256 text CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  duration_ms integer CHECK (duration_ms > 0),
  status text NOT NULL DEFAULT 'quarantine' CHECK (status IN ('quarantine','verified','blocked')),
  delivery_policy text NOT NULL DEFAULT 'none' CHECK (delivery_policy IN ('none','stream','public_illustration')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'verified' OR sha256 IS NOT NULL),
  CHECK (NOT (status='verified' AND kind='audio') OR duration_ms IS NOT NULL)
);

CREATE TABLE canonical_chapters (
  source_id uuid NOT NULL REFERENCES content_sources(id),
  chapter_number smallint NOT NULL CHECK (chapter_number BETWEEN 1 AND 114),
  latin_title text NOT NULL,
  verse_count smallint NOT NULL CHECK (verse_count > 0),
  PRIMARY KEY (source_id,chapter_number)
);

CREATE TABLE canonical_verses (
  source_id uuid NOT NULL,
  verse_key text NOT NULL,
  chapter_number smallint NOT NULL,
  ayah_number smallint NOT NULL CHECK (ayah_number > 0),
  canonical_text text NOT NULL CHECK (length(canonical_text) > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (source_id,verse_key),
  UNIQUE (source_id,chapter_number,ayah_number),
  FOREIGN KEY (source_id,chapter_number)
    REFERENCES canonical_chapters(source_id,chapter_number),
  CHECK (verse_key = chapter_number::text || ':' || ayah_number::text)
);

CREATE TABLE curriculum_releases (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','published','retired','recalled')),
  release_hash text CHECK (release_hash ~ '^[a-f0-9]{64}$'),
  author_id text NOT NULL REFERENCES staff_members(auth_user_id),
  reviewer_id text REFERENCES staff_members(auth_user_id),
  review_evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (reviewer_id IS NULL OR reviewer_id <> author_id),
  CHECK (status NOT IN ('approved','published') OR
    (reviewer_id IS NOT NULL AND review_evidence IS NOT NULL AND release_hash IS NOT NULL))
);

CREATE TABLE children (
  id uuid PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 30),
  avatar_key text NOT NULL CHECK (avatar_key ~ '^[a-z0-9_-]{1,64}$'),
  age_band text NOT NULL CHECK (age_band IN ('5_7','8_10')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deletion_pending')),
  curriculum_release_id uuid REFERENCES curriculum_releases(id),
  starting_stage_key text,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  session_goal_minutes smallint NOT NULL DEFAULT 5 CHECK (session_goal_minutes IN (5,10,15)),
  quiet_celebrations boolean NOT NULL DEFAULT false,
  reduced_motion boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,parent_id)
);
CREATE INDEX children_parent_idx ON children(parent_id,status);

CREATE TABLE session_controls (
  auth_session_id text PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'parent' CHECK (mode IN ('parent','child')),
  active_child_id uuid,
  adult_gate_until timestamptz,
  last_verified_at timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY (active_child_id,parent_id) REFERENCES children(id,parent_id),
  CHECK (mode <> 'child' OR (active_child_id IS NOT NULL AND adult_gate_until IS NULL))
);
-- Clear/revoke session_controls referencing a child before deleting that child.

CREATE TABLE consent_records (
  id uuid PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id uuid,
  scope text NOT NULL CHECK (scope IN ('family','child')),
  purpose text NOT NULL CHECK (purpose='profile_learning'),
  action text NOT NULL CHECK (action IN ('grant','withdraw')),
  notice_version text NOT NULL,
  policy_version text NOT NULL,
  assurance_method text,
  assurance_evidence_reference text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (child_id,parent_id) REFERENCES children(id,parent_id) ON DELETE CASCADE,
  CHECK ((scope='family' AND child_id IS NULL) OR (scope='child' AND child_id IS NOT NULL)),
  CHECK (action <> 'grant' OR (assurance_method IS NOT NULL AND assurance_evidence_reference IS NOT NULL))
);
CREATE INDEX consent_latest_idx ON consent_records(parent_id,child_id,recorded_at DESC);

CREATE TABLE lessons (
  id uuid PRIMARY KEY,
  stable_key text NOT NULL UNIQUE CHECK (stable_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lesson_versions (
  id uuid PRIMARY KEY,
  lesson_id uuid NOT NULL REFERENCES lessons(id),
  version_number integer NOT NULL CHECK (version_number > 0),
  title text NOT NULL,
  lesson_type text NOT NULL CHECK (lesson_type IN ('listening','surah','quiz','game')),
  stage_key text NOT NULL,
  estimated_minutes smallint NOT NULL CHECK (estimated_minutes BETWEEN 1 AND 15),
  demo_only boolean NOT NULL DEFAULT false,
  source_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','published','retired','recalled')),
  release_hash text CHECK (release_hash ~ '^[a-f0-9]{64}$'),
  author_id text NOT NULL REFERENCES staff_members(auth_user_id),
  reviewer_id text REFERENCES staff_members(auth_user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (lesson_id,version_number),
  UNIQUE (id,lesson_id),
  CHECK (reviewer_id IS NULL OR reviewer_id <> author_id),
  CHECK (status NOT IN ('approved','published') OR (reviewer_id IS NOT NULL AND release_hash IS NOT NULL))
);
ALTER TABLE lessons ADD CONSTRAINT current_version_matches_lesson
  FOREIGN KEY (current_version_id,id) REFERENCES lesson_versions(id,lesson_id);
CREATE INDEX lesson_versions_status_idx ON lesson_versions(status,stage_key);
-- source_ids array membership/release rights require service-level validation.
-- Current published selection is lessons.current_version_id; older pinned versions may remain published.

CREATE TABLE stage_overrides (
  child_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES lessons(id),
  reason text NOT NULL CHECK (reason IN ('parent_selected_start','guided_review')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (child_id,lesson_id),
  FOREIGN KEY (child_id,parent_id) REFERENCES children(id,parent_id) ON DELETE CASCADE
);

CREATE TABLE lesson_units (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES lesson_versions(id),
  ordinal integer NOT NULL CHECK (ordinal > 0),
  unit_type text NOT NULL CHECK (unit_type IN ('instruction','letter','ayah','choice')),
  required boolean NOT NULL DEFAULT true,
  instruction text NOT NULL,
  letter text,
  verse_source_id uuid,
  verse_key text,
  audio_asset_id uuid REFERENCES media_assets(id),
  UNIQUE (version_id,ordinal),
  UNIQUE (id,version_id),
  FOREIGN KEY (verse_source_id,verse_key) REFERENCES canonical_verses(source_id,verse_key),
  CHECK ((verse_source_id IS NULL) = (verse_key IS NULL)),
  CHECK (unit_type <> 'letter' OR (letter IS NOT NULL AND char_length(letter) BETWEEN 1 AND 16)),
  CHECK (unit_type <> 'ayah' OR (verse_source_id IS NOT NULL AND verse_key IS NOT NULL))
);

CREATE TABLE questions (
  id uuid PRIMARY KEY,
  unit_id uuid NOT NULL UNIQUE,
  version_id uuid NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  correct_option_id text NOT NULL,
  explanation text NOT NULL,
  source_ids uuid[] NOT NULL DEFAULT '{}',
  UNIQUE (id,version_id),
  FOREIGN KEY (unit_id,version_id) REFERENCES lesson_units(id,version_id),
  CHECK (jsonb_typeof(options)='array'),
  CHECK (jsonb_array_length(options) BETWEEN 2 AND 4)
);
-- Publication verifies unique option IDs and membership of exactly one correct option.

CREATE TABLE content_reviews (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES lesson_versions(id),
  reviewer_id text NOT NULL REFERENCES staff_members(auth_user_id),
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  release_hash text NOT NULL CHECK (release_hash ~ '^[a-f0-9]{64}$'),
  checks jsonb NOT NULL CHECK (jsonb_typeof(checks)='object'),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE learning_sessions (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL,
  version_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','completed','replaced','expired','recalled')),
  presentation_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_sequence integer NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  last_heartbeat_at timestamptz,
  estimated_active_ms bigint NOT NULL DEFAULT 0 CHECK (estimated_active_ms >= 0),
  timezone_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  UNIQUE (id,child_id),
  UNIQUE (id,child_id,version_id),
  FOREIGN KEY (version_id,lesson_id) REFERENCES lesson_versions(id,lesson_id),
  CHECK (expires_at > created_at),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);
CREATE UNIQUE INDEX one_writable_session_per_child ON learning_sessions(child_id)
  WHERE status IN ('active','paused');
CREATE INDEX learning_sessions_child_date_idx ON learning_sessions(child_id,created_at DESC);

CREATE TABLE learning_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  child_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type IN
    ('unit_acknowledged','heartbeat','paused','resumed','answer')),
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL,
  client_at timestamptz,
  server_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id,sequence),
  UNIQUE (id,session_id),
  FOREIGN KEY (session_id,child_id) REFERENCES learning_sessions(id,child_id) ON DELETE CASCADE
);

CREATE TABLE session_units (
  session_id uuid NOT NULL,
  child_id uuid NOT NULL,
  version_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,unit_id),
  FOREIGN KEY (session_id,child_id,version_id)
    REFERENCES learning_sessions(id,child_id,version_id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id,version_id) REFERENCES lesson_units(id,version_id)
);

CREATE TABLE first_answers (
  session_id uuid NOT NULL,
  child_id uuid NOT NULL,
  version_id uuid NOT NULL,
  question_id uuid NOT NULL,
  first_event_id uuid NOT NULL,
  selected_option_id text NOT NULL,
  correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id,question_id),
  FOREIGN KEY (session_id,child_id,version_id)
    REFERENCES learning_sessions(id,child_id,version_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id,version_id) REFERENCES questions(id,version_id),
  FOREIGN KEY (first_event_id,session_id) REFERENCES learning_events(id,session_id) ON DELETE CASCADE
);

CREATE TABLE lesson_progress (
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id),
  first_completed_at timestamptz,
  last_practiced_at timestamptz,
  resume_session_id uuid,
  PRIMARY KEY (child_id,lesson_id),
  FOREIGN KEY (resume_session_id,child_id) REFERENCES learning_sessions(id,child_id)
);

CREATE TABLE rewards (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id),
  reward_type text NOT NULL CHECK (reward_type='first_completion_star'),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id,lesson_id,reward_type)
);

CREATE TABLE parent_assessments (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  chapter_number smallint NOT NULL CHECK (chapter_number BETWEEN 1 AND 114),
  status text NOT NULL CHECK (status IN ('needs_practice','developing','parent_confirmed')),
  observed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (child_id,parent_id) REFERENCES children(id,parent_id) ON DELETE CASCADE
);
CREATE INDEX parent_assessments_latest_idx
  ON parent_assessments(child_id,chapter_number,observed_at DESC);

CREATE TABLE daily_activity (
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  timezone_snapshot text NOT NULL,
  estimated_active_ms bigint NOT NULL DEFAULT 0 CHECK (estimated_active_ms >= 0),
  completed_sessions integer NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
  first_answers integer NOT NULL DEFAULT 0 CHECK (first_answers >= 0),
  correct_first_answers integer NOT NULL DEFAULT 0 CHECK (correct_first_answers >= 0),
  PRIMARY KEY (child_id,local_date,timezone_snapshot),
  CHECK (correct_first_answers <= first_answers)
);

CREATE TABLE content_reports (
  id uuid PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES lesson_versions(id),
  reason text NOT NULL CHECK (reason IN ('wrong_text','wrong_audio','unclear_instruction','other')),
  note text CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_records (
  actor_scope text NOT NULL,
  parent_id uuid REFERENCES parents(id) ON DELETE CASCADE,
  method text NOT NULL,
  route text NOT NULL,
  idempotency_key uuid NOT NULL,
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  response_status integer NOT NULL CHECK (response_status BETWEEN 100 AND 599),
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (actor_scope,method,route,idempotency_key),
  CHECK (expires_at > created_at)
);
-- Store response and hash only, never raw request passwords/assurance tokens.

CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('import','asset_verify','export','delete_child','delete_account')),
  parent_id uuid REFERENCES parents(id) ON DELETE SET NULL,
  staff_actor_id text REFERENCES staff_members(auth_user_id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','canceled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_until timestamptz,
  result_object_key text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX jobs_claim_idx ON jobs(status,lease_until,created_at);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  actor_reference text NOT NULL,
  action text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success','denied','failed')),
  request_id text NOT NULL,
  redacted_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_date_idx ON audit_events(created_at DESC);

-- Database backstop for the most sensitive source text invariant.
CREATE FUNCTION forbid_canonical_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Canonical source rows are immutable; import a new source version';
END;
$$;
CREATE TRIGGER canonical_verses_no_change BEFORE UPDATE OR DELETE ON canonical_verses
  FOR EACH ROW EXECUTE FUNCTION forbid_canonical_mutation();
CREATE TRIGGER canonical_chapters_no_change BEFORE UPDATE OR DELETE ON canonical_chapters
  FOR EACH ROW EXECUTE FUNCTION forbid_canonical_mutation();

-- Child/public DTOs must never SELECT * from questions or internal content records.
-- Add auth FKs, service policies, publication immutability guards, append-only role
-- grants and retention/deletion jobs in real migrations; none are automatic here.
COMMIT;
