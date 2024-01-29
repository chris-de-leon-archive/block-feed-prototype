CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "customer" (
  "id" TEXT PRIMARY KEY,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "webhook" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "chain_id" TEXT NOT NULL,
	"url" TEXT NOT NULL,
  "max_retries" INTEGER NOT NULL,
  "timeout_ms" INTEGER NOT NULL,
  "retry_delay_ms" INTEGER NOT NULL,
  "customer_id" TEXT NOT NULL, 
  FOREIGN KEY ("customer_id") REFERENCES "customer" ("id")
);

CREATE TABLE "pending_webhook_job" (
	"block_height" TEXT,
  "chain_id" TEXT NOT NULL,
  "chain_url" TEXT NOT NULL,
  "channel_name" TEXT NOT NULL,
  PRIMARY KEY ("chain_id", "block_height")
);

CREATE TABLE "webhook_job" (
	"id" BIGSERIAL PRIMARY KEY,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "chain_id" TEXT NOT NULL,
  "chain_url" TEXT NOT NULL,
	"block_height" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "max_retries" INTEGER NOT NULL, 
  "timeout_ms" INTEGER NOT NULL,
  "retry_delay_ms" INTEGER NOT NULL 
);

CREATE TABLE "block_cursor" (
  "id" TEXT PRIMARY KEY,
	"block_height" TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION create_webhook_jobs_trigger_fn() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "webhook_job"(
    "chain_id",
    "chain_url",
	  "block_height",
    "url",
    "max_retries",
    "timeout_ms",
    "retry_delay_ms"
  ) 
  SELECT
    NEW.chain_id,
    NEW.chain_url,
    NEW.block_height,
    "webhook".url,
    "webhook".max_retries,
    "webhook".timeout_ms,
    "webhook".retry_delay_ms
  FROM "webhook"
  WHERE "chain_id" = NEW.chain_id;

  DELETE FROM "pending_webhook_job" 
  WHERE "block_height" = NEW.block_height
  AND "chain_id" = NEW.chain_id;

  PERFORM pg_notify(NEW.channel_name, '');

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_webhook_jobs_trigger
AFTER INSERT ON "pending_webhook_job"
FOR EACH ROW 
EXECUTE FUNCTION create_webhook_jobs_trigger_fn();

