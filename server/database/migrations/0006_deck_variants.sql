CREATE TABLE "deck_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"deck_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_variants" ADD CONSTRAINT "deck_variants_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deck_variants" ADD CONSTRAINT "deck_variants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "deck_variants_deck_id_idx" ON "deck_variants" USING btree ("deck_id");
--> statement-breakpoint
CREATE TABLE "deck_variant_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"deck_id" text NOT NULL,
	"base_card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source_person_id" text,
	"source_photo_id" text,
	"prompt" text,
	"status" "card_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_image_key" text,
	"raw_image_url" text,
	"final_image_key" text,
	"final_image_url" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deck_variant_cards_variant_id_base_card_id_unique" UNIQUE("variant_id","base_card_id")
);
--> statement-breakpoint
ALTER TABLE "deck_variant_cards" ADD CONSTRAINT "deck_variant_cards_variant_id_deck_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."deck_variants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deck_variant_cards" ADD CONSTRAINT "deck_variant_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deck_variant_cards" ADD CONSTRAINT "deck_variant_cards_base_card_id_deck_cards_id_fk" FOREIGN KEY ("base_card_id") REFERENCES "public"."deck_cards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deck_variant_cards" ADD CONSTRAINT "deck_variant_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deck_variant_cards" ADD CONSTRAINT "deck_variant_cards_source_person_id_deck_persons_id_fk" FOREIGN KEY ("source_person_id") REFERENCES "public"."deck_persons"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "deck_variant_cards" ADD CONSTRAINT "deck_variant_cards_source_photo_id_deck_photos_id_fk" FOREIGN KEY ("source_photo_id") REFERENCES "public"."deck_photos"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "deck_variant_cards_variant_id_idx" ON "deck_variant_cards" USING btree ("variant_id");
--> statement-breakpoint
CREATE INDEX "deck_variant_cards_deck_id_idx" ON "deck_variant_cards" USING btree ("deck_id");
