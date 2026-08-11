ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_updated_at" timestamp;--> statement-breakpoint
CREATE TYPE "public"."auth_token_purpose" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET');--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" "auth_token_purpose" NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_idx" ON "auth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_tokens_purpose_idx" ON "auth_tokens" USING btree ("purpose","expires_at");--> statement-breakpoint
CREATE INDEX "auth_tokens_used_at_idx" ON "auth_tokens" USING btree ("used_at");
