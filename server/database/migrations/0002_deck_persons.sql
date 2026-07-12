CREATE TABLE "deck_persons" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_persons" ADD CONSTRAINT "deck_persons_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deck_persons" ADD CONSTRAINT "deck_persons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "deck_persons_deck_id_idx" ON "deck_persons" USING btree ("deck_id");
--> statement-breakpoint
CREATE INDEX "deck_persons_user_id_idx" ON "deck_persons" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "deck_photos" ADD COLUMN "person_id" text;
--> statement-breakpoint
ALTER TABLE "deck_cards" ADD COLUMN "source_person_id" text;
--> statement-breakpoint
INSERT INTO "deck_persons" ("id", "deck_id", "user_id", "label", "created_at", "updated_at")
SELECT "id", "deck_id", "user_id", "label", "created_at", "created_at"
FROM "deck_photos";
--> statement-breakpoint
UPDATE "deck_photos" SET "person_id" = "id";
--> statement-breakpoint
UPDATE "deck_cards" SET "source_person_id" = "source_photo_id" WHERE "source_photo_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "deck_photos" ADD CONSTRAINT "deck_photos_person_id_deck_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."deck_persons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_source_person_id_deck_persons_id_fk" FOREIGN KEY ("source_person_id") REFERENCES "public"."deck_persons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "deck_photos_person_id_idx" ON "deck_photos" USING btree ("person_id");
--> statement-breakpoint
CREATE INDEX "deck_cards_source_person_id_idx" ON "deck_cards" USING btree ("source_person_id");
