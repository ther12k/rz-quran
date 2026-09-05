CREATE TABLE "deletion_suppressions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"reference_key" text NOT NULL,
	"nickname_hash" text,
	"reason" text NOT NULL,
	"requested_by" text NOT NULL,
	"suppressed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deletion_suppressions_unique" UNIQUE("scope","reference_key"),
	CONSTRAINT "suppression_scope_domain" CHECK ("deletion_suppressions"."scope" in ('child','parent','auth_user')),
	CONSTRAINT "suppression_reason_domain" CHECK ("deletion_suppressions"."reason" in ('parent_request','account_deletion','policy'))
);
--> statement-breakpoint
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_current_version_fk";
--> statement-breakpoint
ALTER TABLE "first_answers" DROP CONSTRAINT "first_answers_session_fk";
--> statement-breakpoint
ALTER TABLE "first_answers" DROP CONSTRAINT "first_answers_event_fk";
--> statement-breakpoint
ALTER TABLE "learning_events" DROP CONSTRAINT "learning_events_session_fk";
--> statement-breakpoint
ALTER TABLE "session_units" DROP CONSTRAINT "session_units_session_fk";
--> statement-breakpoint
ALTER TABLE "first_answers" ADD CONSTRAINT "first_answers_session_fk" FOREIGN KEY ("session_id","child_id","version_id") REFERENCES "public"."learning_sessions"("id","child_id","version_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "first_answers" ADD CONSTRAINT "first_answers_event_fk" FOREIGN KEY ("first_event_id","session_id") REFERENCES "public"."learning_events"("id","session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_session_fk" FOREIGN KEY ("session_id","child_id") REFERENCES "public"."learning_sessions"("id","child_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_units" ADD CONSTRAINT "session_units_session_fk" FOREIGN KEY ("session_id","child_id","version_id") REFERENCES "public"."learning_sessions"("id","child_id","version_id") ON DELETE cascade ON UPDATE no action;