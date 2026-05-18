ALTER TABLE "decks" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "decks_deleted_at_idx" ON "decks" USING btree ("deleted_at");