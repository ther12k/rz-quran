CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"avatar_key" text NOT NULL,
	"age_band" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"curriculum_release_id" uuid,
	"starting_stage_key" text,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"session_goal_minutes" smallint DEFAULT 5 NOT NULL,
	"quiet_celebrations" boolean DEFAULT false NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "children_id_parent_unique" UNIQUE("id","parent_id"),
	CONSTRAINT "children_nickname_length" CHECK (char_length("children"."nickname") between 1 and 30),
	CONSTRAINT "children_avatar_key_format" CHECK ("children"."avatar_key" ~ '^[a-z0-9_-]{1,64}$'),
	CONSTRAINT "children_age_band_domain" CHECK ("children"."age_band" in ('5_7','8_10')),
	CONSTRAINT "children_status_domain" CHECK ("children"."status" in ('active','suspended','deletion_pending')),
	CONSTRAINT "children_goal_domain" CHECK ("children"."session_goal_minutes" in (5,10,15))
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid NOT NULL,
	"child_id" uuid,
	"scope" text NOT NULL,
	"purpose" text DEFAULT 'profile_learning' NOT NULL,
	"action" text NOT NULL,
	"notice_version" text NOT NULL,
	"policy_version" text NOT NULL,
	"assurance_method" text,
	"assurance_evidence_reference" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_scope_shape" CHECK (("consent_records"."scope" = 'family' and "consent_records"."child_id" is null) or ("consent_records"."scope" = 'child' and "consent_records"."child_id" is not null)),
	CONSTRAINT "consent_grant_needs_assurance" CHECK ("consent_records"."action" <> 'grant' or ("consent_records"."assurance_method" is not null and "consent_records"."assurance_evidence_reference" is not null)),
	CONSTRAINT "consent_purpose_domain" CHECK ("consent_records"."purpose" = 'profile_learning')
);
--> statement-breakpoint
CREATE TABLE "daily_activity" (
	"child_id" uuid NOT NULL,
	"local_date" text NOT NULL,
	"timezone_snapshot" text NOT NULL,
	"estimated_active_ms" bigint DEFAULT 0 NOT NULL,
	"completed_sessions" integer DEFAULT 0 NOT NULL,
	"first_answers" integer DEFAULT 0 NOT NULL,
	"correct_first_answers" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_activity_unique" UNIQUE("child_id","local_date","timezone_snapshot"),
	CONSTRAINT "daily_activity_nonnegative" CHECK ("daily_activity"."estimated_active_ms" >= 0 and "daily_activity"."completed_sessions" >= 0 and "daily_activity"."first_answers" >= 0 and "daily_activity"."correct_first_answers" >= 0),
	CONSTRAINT "daily_activity_correct_le_first" CHECK ("daily_activity"."correct_first_answers" <= "daily_activity"."first_answers")
);
--> statement-breakpoint
CREATE TABLE "parent_assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"child_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"chapter_number" smallint NOT NULL,
	"status" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_chapter_range" CHECK ("parent_assessments"."chapter_number" between 1 and 114),
	CONSTRAINT "assessments_status_domain" CHECK ("parent_assessments"."status" in ('needs_practice','developing','parent_confirmed'))
);
--> statement-breakpoint
CREATE TABLE "parents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"eligibility_status" text DEFAULT 'pending' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parents_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "session_controls" (
	"auth_session_id" text PRIMARY KEY NOT NULL,
	"parent_id" uuid NOT NULL,
	"mode" text DEFAULT 'parent' NOT NULL,
	"active_child_id" uuid,
	"adult_gate_until" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "session_controls_mode_domain" CHECK ("session_controls"."mode" in ('parent','child')),
	CONSTRAINT "session_controls_child_mode_shape" CHECK ("session_controls"."mode" <> 'child' or ("session_controls"."active_child_id" is not null and "session_controls"."adult_gate_until" is null))
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"auth_user_id" text PRIMARY KEY NOT NULL,
	"capabilities" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_overrides" (
	"child_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "stage_overrides_child_id_lesson_id_pk" PRIMARY KEY("child_id","lesson_id"),
	CONSTRAINT "stage_overrides_reason_domain" CHECK ("stage_overrides"."reason" in ('parent_selected_start','guided_review'))
);
--> statement-breakpoint
CREATE TABLE "canonical_chapters" (
	"source_id" uuid NOT NULL,
	"chapter_number" smallint NOT NULL,
	"latin_title" text NOT NULL,
	"verse_count" smallint NOT NULL,
	CONSTRAINT "canonical_chapters_pk" UNIQUE("source_id","chapter_number")
);
--> statement-breakpoint
CREATE TABLE "canonical_verses" (
	"source_id" uuid NOT NULL,
	"verse_key" text NOT NULL,
	"chapter_number" smallint NOT NULL,
	"ayah_number" smallint NOT NULL,
	"canonical_text" text NOT NULL,
	"sha256" text NOT NULL,
	CONSTRAINT "canonical_verses_pk" UNIQUE("source_id","verse_key"),
	CONSTRAINT "canonical_verses_chapter_ayah" UNIQUE("source_id","chapter_number","ayah_number"),
	CONSTRAINT "canonical_verses_ayah_positive" CHECK ("canonical_verses"."ayah_number" > 0),
	CONSTRAINT "canonical_verses_text_present" CHECK (length("canonical_verses"."canonical_text") > 0),
	CONSTRAINT "canonical_verses_key_shape" CHECK ("canonical_verses"."verse_key" = "canonical_verses"."chapter_number"::text || ':' || "canonical_verses"."ayah_number"::text),
	CONSTRAINT "canonical_verses_hash_format" CHECK ("canonical_verses"."sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" text NOT NULL,
	"release_hash" text NOT NULL,
	"checks" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_kind" text NOT NULL,
	"title" text NOT NULL,
	"source_version" text NOT NULL,
	"upstream_reference" text,
	"acquired_at" timestamp with time zone NOT NULL,
	"demo_only" boolean DEFAULT false NOT NULL,
	"rights_status" text DEFAULT 'pending' NOT NULL,
	"permitted_uses" text[] DEFAULT '{}'::text[] NOT NULL,
	"license_reference" text,
	"attribution" text DEFAULT '' NOT NULL,
	"evidence_object_key" text,
	"raw_object_key" text,
	"raw_sha256" text,
	"registered_by" text NOT NULL,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_releases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"version_number" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"release_hash" text,
	"author_id" text NOT NULL,
	"reviewer_id" text,
	"review_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lesson_units" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"unit_type" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"instruction" text NOT NULL,
	"letter" text,
	"verse_source_id" uuid,
	"verse_key" text,
	"audio_asset_id" uuid,
	CONSTRAINT "lesson_units_version_ordinal" UNIQUE("version_id","ordinal"),
	CONSTRAINT "lesson_units_id_version" UNIQUE("id","version_id"),
	CONSTRAINT "lesson_units_ordinal_positive" CHECK ("lesson_units"."ordinal" > 0),
	CONSTRAINT "lesson_units_verse_pair" CHECK (("lesson_units"."verse_source_id" is null) = ("lesson_units"."verse_key" is null)),
	CONSTRAINT "lesson_units_letter_shape" CHECK ("lesson_units"."unit_type" <> 'letter' or ("lesson_units"."letter" is not null and char_length("lesson_units"."letter") between 1 and 16)),
	CONSTRAINT "lesson_units_ayah_shape" CHECK ("lesson_units"."unit_type" <> 'ayah' or ("lesson_units"."verse_source_id" is not null and "lesson_units"."verse_key" is not null))
);
--> statement-breakpoint
CREATE TABLE "lesson_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lesson_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"lesson_type" text NOT NULL,
	"stage_key" text NOT NULL,
	"estimated_minutes" smallint NOT NULL,
	"demo_only" boolean DEFAULT false NOT NULL,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"release_hash" text,
	"author_id" text NOT NULL,
	"reviewer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "lesson_versions_lesson_number" UNIQUE("lesson_id","version_number"),
	CONSTRAINT "lesson_versions_id_lesson" UNIQUE("id","lesson_id"),
	CONSTRAINT "lesson_versions_number_positive" CHECK ("lesson_versions"."version_number" > 0),
	CONSTRAINT "lesson_versions_minutes_range" CHECK ("lesson_versions"."estimated_minutes" between 1 and 15),
	CONSTRAINT "lesson_versions_distinct_reviewer" CHECK ("lesson_versions"."reviewer_id" is null or "lesson_versions"."reviewer_id" <> "lesson_versions"."author_id"),
	CONSTRAINT "lesson_versions_approved_shape" CHECK ("lesson_versions"."status" not in ('approved','published') or ("lesson_versions"."reviewer_id" is not null and "lesson_versions"."release_hash" is not null))
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"stable_key" text NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_stable_key_unique" UNIQUE("stable_key"),
	CONSTRAINT "lessons_stable_key_format" CHECK ("lessons"."stable_key" ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"duration_ms" integer,
	"status" text DEFAULT 'quarantine' NOT NULL,
	"delivery_policy" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"unit_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option_id" text NOT NULL,
	"explanation" text NOT NULL,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	CONSTRAINT "questions_unit_id_unique" UNIQUE("unit_id"),
	CONSTRAINT "questions_id_version" UNIQUE("id","version_id"),
	CONSTRAINT "questions_options_count" CHECK (jsonb_array_length("questions"."options") between 2 and 4)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_reference" text NOT NULL,
	"action" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"outcome" text NOT NULL,
	"request_id" text NOT NULL,
	"redacted_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_outcome_domain" CHECK ("audit_events"."outcome" in ('success','denied','failed'))
);
--> statement-breakpoint
CREATE TABLE "first_answers" (
	"session_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"first_event_id" uuid NOT NULL,
	"selected_option_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "first_answers_session_id_question_id_pk" PRIMARY KEY("session_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"actor_scope" text NOT NULL,
	"parent_id" uuid,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_sha256" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_records_key" UNIQUE("actor_scope","method","route","idempotency_key"),
	CONSTRAINT "idempotency_hash_format" CHECK ("idempotency_records"."request_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "idempotency_status_range" CHECK ("idempotency_records"."response_status" between 100 and 599),
	CONSTRAINT "idempotency_expiry" CHECK ("idempotency_records"."expires_at" > "idempotency_records"."created_at")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"parent_id" uuid,
	"staff_actor_id" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"result_object_key" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "learning_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_sha256" text NOT NULL,
	"result" jsonb NOT NULL,
	"client_at" timestamp with time zone,
	"server_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_events_session_sequence" UNIQUE("session_id","sequence"),
	CONSTRAINT "learning_events_id_session" UNIQUE("id","session_id"),
	CONSTRAINT "learning_events_sequence_positive" CHECK ("learning_events"."sequence" > 0),
	CONSTRAINT "learning_events_payload_hash_format" CHECK ("learning_events"."payload_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "learning_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"child_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"presentation_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"estimated_active_ms" bigint DEFAULT 0 NOT NULL,
	"timezone_snapshot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "learning_sessions_id_child" UNIQUE("id","child_id"),
	CONSTRAINT "learning_sessions_id_child_version" UNIQUE("id","child_id","version_id"),
	CONSTRAINT "learning_sessions_sequence_nonnegative" CHECK ("learning_sessions"."last_sequence" >= 0),
	CONSTRAINT "learning_sessions_active_nonnegative" CHECK ("learning_sessions"."estimated_active_ms" >= 0),
	CONSTRAINT "learning_sessions_expiry_after_creation" CHECK ("learning_sessions"."expires_at" > "learning_sessions"."created_at"),
	CONSTRAINT "learning_sessions_completed_shape" CHECK ("learning_sessions"."status" <> 'completed' or "learning_sessions"."completed_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"child_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"first_completed_at" timestamp with time zone,
	"last_practiced_at" timestamp with time zone,
	"resume_session_id" uuid,
	CONSTRAINT "lesson_progress_child_lesson" UNIQUE("child_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"child_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"reward_type" text NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rewards_child_lesson_type" UNIQUE("child_id","lesson_id","reward_type"),
	CONSTRAINT "rewards_type_domain" CHECK ("rewards"."reward_type" = 'first_completion_star')
);
--> statement-breakpoint
CREATE TABLE "session_units" (
	"session_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_units_session_id_unit_id_pk" PRIMARY KEY("session_id","unit_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_controls" ADD CONSTRAINT "session_controls_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_auth_user_id_user_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_overrides" ADD CONSTRAINT "stage_overrides_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_chapters" ADD CONSTRAINT "canonical_chapters_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_verses" ADD CONSTRAINT "canonical_verses_chapter_fk" FOREIGN KEY ("source_id","chapter_number") REFERENCES "public"."canonical_chapters"("source_id","chapter_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_version_id_lesson_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."lesson_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_reviewer_id_staff_members_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."staff_members"("auth_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_registered_by_staff_members_auth_user_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."staff_members"("auth_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_reviewed_by_staff_members_auth_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_members"("auth_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_releases" ADD CONSTRAINT "curriculum_releases_author_id_staff_members_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."staff_members"("auth_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_releases" ADD CONSTRAINT "curriculum_releases_reviewer_id_staff_members_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."staff_members"("auth_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_units" ADD CONSTRAINT "lesson_units_version_id_lesson_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."lesson_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_units" ADD CONSTRAINT "lesson_units_audio_asset_id_media_assets_id_fk" FOREIGN KEY ("audio_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_units" ADD CONSTRAINT "lesson_units_verse_fk" FOREIGN KEY ("verse_source_id","verse_key") REFERENCES "public"."canonical_verses"("source_id","verse_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_author_id_staff_members_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."staff_members"("auth_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_reviewer_id_staff_members_auth_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."staff_members"("auth_user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_current_version_fk" FOREIGN KEY ("current_version_id","id") REFERENCES "public"."lesson_versions"("id","lesson_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_unit_id_lesson_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."lesson_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_unit_fk" FOREIGN KEY ("unit_id","version_id") REFERENCES "public"."lesson_units"("id","version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "first_answers" ADD CONSTRAINT "first_answers_session_fk" FOREIGN KEY ("session_id","child_id","version_id") REFERENCES "public"."learning_sessions"("id","child_id","version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "first_answers" ADD CONSTRAINT "first_answers_question_fk" FOREIGN KEY ("question_id","version_id") REFERENCES "public"."questions"("id","version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "first_answers" ADD CONSTRAINT "first_answers_event_fk" FOREIGN KEY ("first_event_id","session_id") REFERENCES "public"."learning_events"("id","session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_session_fk" FOREIGN KEY ("session_id","child_id") REFERENCES "public"."learning_sessions"("id","child_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_version_fk" FOREIGN KEY ("version_id","lesson_id") REFERENCES "public"."lesson_versions"("id","lesson_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_resume_fk" FOREIGN KEY ("resume_session_id","child_id") REFERENCES "public"."learning_sessions"("id","child_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_units" ADD CONSTRAINT "session_units_session_fk" FOREIGN KEY ("session_id","child_id","version_id") REFERENCES "public"."learning_sessions"("id","child_id","version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_units" ADD CONSTRAINT "session_units_unit_fk" FOREIGN KEY ("unit_id","version_id") REFERENCES "public"."lesson_units"("id","version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "children_parent_idx" ON "children" USING btree ("parent_id","status");--> statement-breakpoint
CREATE INDEX "consent_latest_idx" ON "consent_records" USING btree ("parent_id","child_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "parent_assessments_latest_idx" ON "parent_assessments" USING btree ("child_id","chapter_number","observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lesson_versions_status_idx" ON "lesson_versions" USING btree ("status","stage_key");--> statement-breakpoint
CREATE INDEX "audit_events_date_idx" ON "audit_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "learning_sessions_child_date_idx" ON "learning_sessions" USING btree ("child_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "one_writable_session_per_child" ON "learning_sessions" USING btree ("child_id") WHERE "learning_sessions"."status" in ('active','paused');