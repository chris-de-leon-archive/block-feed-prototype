-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE SCHEMA "block_feed";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "block_feed"."blockchain" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "block_feed"."webhook" (
	"id" uuid PRIMARY KEY DEFAULT block_feed.uuid_generate_v4() NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"url" text NOT NULL,
	"max_blocks" integer NOT NULL,
	"max_retries" integer NOT NULL,
	"timeout_ms" integer NOT NULL,
	"customer_id" text NOT NULL,
	"blockchain_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "block_feed"."customer" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "block_feed"."webhook_job" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"block_height" bigint NOT NULL,
	"webhook_id" uuid NOT NULL,
	CONSTRAINT "webhook_job_webhook_id_key" UNIQUE("webhook_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "block_feed"."block_cursor" (
	"id" text PRIMARY KEY NOT NULL,
	"blockchain_id" text NOT NULL,
	"block_height" bigint NOT NULL,
	CONSTRAINT "unique_block_height_per_chain" UNIQUE("blockchain_id","block_height")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "block_feed"."block_cache" (
	"blockchain_id" text NOT NULL,
	"block_height" bigint NOT NULL,
	"block" jsonb NOT NULL,
	CONSTRAINT "block_cache_pkey" PRIMARY KEY("blockchain_id","block_height")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "block_feed"."webhook" ADD CONSTRAINT "webhook_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "block_feed"."customer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "block_feed"."webhook" ADD CONSTRAINT "webhook_blockchain_id_fkey" FOREIGN KEY ("blockchain_id") REFERENCES "block_feed"."blockchain"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "block_feed"."webhook_job" ADD CONSTRAINT "webhook_job_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "block_feed"."webhook"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "block_feed"."block_cursor" ADD CONSTRAINT "block_cursor_blockchain_id_fkey" FOREIGN KEY ("blockchain_id") REFERENCES "block_feed"."blockchain"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "block_feed"."block_cache" ADD CONSTRAINT "block_cache_blockchain_id_fkey" FOREIGN KEY ("blockchain_id") REFERENCES "block_feed"."blockchain"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

*/