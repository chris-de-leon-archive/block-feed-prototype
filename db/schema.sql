CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "customer" (
  "id" TEXT PRIMARY KEY,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "blockchain" (
  "id" TEXT PRIMARY KEY,
  "url" TEXT NOT NULL
);

CREATE TABLE "webhook" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"url" TEXT NOT NULL,
  "max_blocks" INTEGER NOT NULL,
  "max_retries" INTEGER NOT NULL,
  "timeout_ms" INTEGER NOT NULL,
  "customer_id" TEXT NOT NULL, 
  "blockchain_id" TEXT NOT NULL,
  FOREIGN KEY ("customer_id") REFERENCES "customer" ("id"),
  FOREIGN KEY ("blockchain_id") REFERENCES "blockchain" ("id")
);

CREATE TABLE "webhook_job" (
	"id" BIGSERIAL PRIMARY KEY,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "block_height" BIGINT NOT NULL,
  "webhook_id" UUID NOT NULL UNIQUE,
  FOREIGN KEY ("webhook_id") REFERENCES "webhook" ("id")
);

CREATE TABLE "block_cursor" (
  "id" TEXT PRIMARY KEY,
  "blockchain_id" TEXT NOT NULL,
  "block_height" BIGINT NOT NULL,
  FOREIGN KEY ("blockchain_id") REFERENCES "blockchain" ("id"),
  CONSTRAINT unique_block_height_per_chain UNIQUE ("blockchain_id", "block_height")
);

CREATE TABLE "block_cache" (
  "blockchain_id" TEXT NOT NULL,
  "block_height" BIGINT NOT NULL,
  "block" JSONB NOT NULL,
  FOREIGN KEY ("blockchain_id") REFERENCES "blockchain" ("id"),
  PRIMARY KEY ("blockchain_id", "block_height")
);

