CREATE TABLE "kids_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pairing_id" uuid,
	"child_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"audience" text DEFAULT 'rzq-kids-staging' NOT NULL,
	"minted_env" text NOT NULL,
	"lesson_allowlist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_build_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	CONSTRAINT "kids_grants_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "kids_grants_expiry_after_creation" CHECK ("kids_grants"."expires_at" > "kids_grants"."created_at"),
	CONSTRAINT "kids_grants_audience_domain" CHECK ("kids_grants"."audience" = 'rzq-kids-staging')
);
--> statement-breakpoint
CREATE TABLE "kids_pairing_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pairing_id" uuid,
	"source_hash" text NOT NULL,
	"kind" text NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kids_pairing_attempts_kind_domain" CHECK ("kids_pairing_attempts"."kind" in ('poll','code_entry'))
);
--> statement-breakpoint
CREATE TABLE "kids_pairings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"code_challenge" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_child_id" uuid,
	"approved_by_parent_id" uuid,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"client_build_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	CONSTRAINT "kids_pairings_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "kids_pairings_status_domain" CHECK ("kids_pairings"."status" in ('pending','approved','denied','redeemed','expired')),
	CONSTRAINT "kids_pairings_attempts_bounded" CHECK ("kids_pairings"."attempt_count" >= 0 and "kids_pairings"."attempt_count" <= 1000),
	CONSTRAINT "kids_pairings_expiry_after_creation" CHECK ("kids_pairings"."expires_at" > "kids_pairings"."created_at"),
	CONSTRAINT "kids_pairings_approved_shape" CHECK ("kids_pairings"."status" <> 'approved' or ("kids_pairings"."approved_child_id" is not null and "kids_pairings"."approved_by_parent_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "kids_grants" ADD CONSTRAINT "kids_grants_pairing_id_kids_pairings_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."kids_pairings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_grants" ADD CONSTRAINT "kids_grants_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_grants" ADD CONSTRAINT "kids_grants_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_pairing_attempts" ADD CONSTRAINT "kids_pairing_attempts_pairing_id_kids_pairings_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."kids_pairings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_pairings" ADD CONSTRAINT "kids_pairings_approved_child_id_children_id_fk" FOREIGN KEY ("approved_child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kids_pairings" ADD CONSTRAINT "kids_pairings_approved_by_parent_id_parents_id_fk" FOREIGN KEY ("approved_by_parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kids_grants_child_idx" ON "kids_grants" USING btree ("child_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kids_grants_one_live_per_child" ON "kids_grants" USING btree ("child_id") WHERE "kids_grants"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "kids_pairing_attempts_source_idx" ON "kids_pairing_attempts" USING btree ("source_hash","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "kids_pairing_attempts_pairing_idx" ON "kids_pairing_attempts" USING btree ("pairing_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "kids_pairings_status_idx" ON "kids_pairings" USING btree ("status","expires_at");