CREATE TYPE "public"."card_status" AS ENUM('pending', 'queued', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deck_status" AS ENUM('draft', 'queued', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deck_type" AS ENUM('classic52', 'tarot56', 'tarot78');--> statement-breakpoint
CREATE TYPE "public"."export_job_status" AS ENUM('queued', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."export_type" AS ENUM('images', 'zip', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."generation_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "deck_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source_photo_id" text,
	"card_code" text NOT NULL,
	"status" "card_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb NOT NULL,
	"prompt" text,
	"raw_image_key" text,
	"raw_image_url" text,
	"final_image_key" text,
	"final_image_url" text,
	"error_message" text,
	"sort_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deck_cards_deck_id_card_code_unique" UNIQUE("deck_id","card_code")
);
--> statement-breakpoint
CREATE TABLE "deck_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"original_filename" text,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "deck_type" NOT NULL,
	"status" "deck_status" DEFAULT 'draft' NOT NULL,
	"settings" jsonb DEFAULT '{"allowPhotoReuse":true,"visualStyle":"illustration royale contemporaine"}'::jsonb NOT NULL,
	"card_count" integer DEFAULT 0 NOT NULL,
	"ready_card_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" "export_type" NOT NULL,
	"status" "export_job_status" DEFAULT 'queued' NOT NULL,
	"storage_key" text,
	"url" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"total_cards" integer DEFAULT 0 NOT NULL,
	"completed_cards" integer DEFAULT 0 NOT NULL,
	"failed_cards" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"picture" text,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"provider" text,
	"provider_user_id" text,
	"locale" text DEFAULT 'fr-FR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"email_verified_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_provider_provider_user_id_unique" UNIQUE("provider","provider_user_id")
);
--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_source_photo_id_deck_photos_id_fk" FOREIGN KEY ("source_photo_id") REFERENCES "public"."deck_photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_photos" ADD CONSTRAINT "deck_photos_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_photos" ADD CONSTRAINT "deck_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_cards_deck_id_idx" ON "deck_cards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "deck_cards_user_id_idx" ON "deck_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deck_cards_status_idx" ON "deck_cards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deck_photos_deck_id_idx" ON "deck_photos" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "deck_photos_user_id_idx" ON "deck_photos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "decks_user_id_idx" ON "decks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "decks_status_idx" ON "decks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "export_jobs_deck_id_idx" ON "export_jobs" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "export_jobs_user_id_idx" ON "export_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "export_jobs_status_idx" ON "export_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_jobs_deck_id_idx" ON "generation_jobs" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_user_id_idx" ON "generation_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");