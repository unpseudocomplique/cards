CREATE TABLE "tarot_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"host_user_id" text,
	"deck_id" text,
	"player_count" integer NOT NULL,
	"end_mode" text NOT NULL,
	"end_value" integer NOT NULL,
	"with_bots" boolean DEFAULT false NOT NULL,
	"seats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deal_count" integer DEFAULT 0 NOT NULL,
	"final_scores" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "tarot_matches" ADD CONSTRAINT "tarot_matches_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tarot_matches_finished_at_idx" ON "tarot_matches" USING btree ("finished_at");
--> statement-breakpoint
CREATE TABLE "tarot_deals" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"deal_index" integer NOT NULL,
	"player_count" integer NOT NULL,
	"with_bots" boolean DEFAULT false NOT NULL,
	"contract" text NOT NULL,
	"success" boolean NOT NULL,
	"record" jsonb NOT NULL,
	"played_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tarot_deals_match_id_deal_index_unique" UNIQUE("match_id","deal_index")
);
--> statement-breakpoint
ALTER TABLE "tarot_deals" ADD CONSTRAINT "tarot_deals_match_id_tarot_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tarot_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tarot_deals_played_at_idx" ON "tarot_deals" USING btree ("played_at");
--> statement-breakpoint
CREATE TABLE "tarot_deal_players" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"match_id" text NOT NULL,
	"user_id" text NOT NULL,
	"seat" integer NOT NULL,
	"role" text NOT NULL,
	"bid" text,
	"won" boolean NOT NULL,
	"delta" integer NOT NULL,
	"player_count" integer NOT NULL,
	"with_bots" boolean DEFAULT false NOT NULL,
	"played_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tarot_deal_players_deal_id_user_id_unique" UNIQUE("deal_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "tarot_deal_players" ADD CONSTRAINT "tarot_deal_players_deal_id_tarot_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."tarot_deals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tarot_deal_players" ADD CONSTRAINT "tarot_deal_players_match_id_tarot_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tarot_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tarot_deal_players" ADD CONSTRAINT "tarot_deal_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tarot_deal_players_user_idx" ON "tarot_deal_players" USING btree ("user_id","played_at");
--> statement-breakpoint
CREATE INDEX "tarot_deal_players_match_idx" ON "tarot_deal_players" USING btree ("match_id");
--> statement-breakpoint
CREATE TABLE "tarot_match_players" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"user_id" text NOT NULL,
	"seat" integer NOT NULL,
	"score" integer NOT NULL,
	"rank" integer NOT NULL,
	"finished_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tarot_match_players_match_id_user_id_unique" UNIQUE("match_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "tarot_match_players" ADD CONSTRAINT "tarot_match_players_match_id_tarot_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tarot_matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tarot_match_players" ADD CONSTRAINT "tarot_match_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tarot_match_players_user_idx" ON "tarot_match_players" USING btree ("user_id","finished_at");
