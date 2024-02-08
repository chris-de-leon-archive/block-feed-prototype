-- TODO: remove this since it is only used for testing purposes

-- name: CreateWebhook :execrows
WITH 
  inserted_user AS (
    INSERT INTO "customer" ("id", "created_at")
    VALUES (sqlc.arg('customer_id')::TEXT, DEFAULT)
    ON CONFLICT ("id") DO NOTHING
  ), 
  inserted_blockchain AS (
    INSERT INTO "blockchain" ("id", "url") 
    VALUES (sqlc.arg('blockchain_id'), sqlc.arg('blockchain_url'))
    ON CONFLICT ("id") DO UPDATE SET "url" = EXCLUDED."url"
  ),
  inserted_webhook AS (
    INSERT INTO "webhook" (
      "id",
      "created_at",
      "url",
      "max_blocks",
      "max_retries",
      "timeout_ms",
      "customer_id",
      "blockchain_id"
    ) VALUES (
      DEFAULT,
      DEFAULT,
      sqlc.arg('url'),
      sqlc.arg('max_blocks'),
      sqlc.arg('max_retries'),
      sqlc.arg('timeout_ms'),
      sqlc.arg('customer_id'),
      sqlc.arg('blockchain_id')
    )
    RETURNING "id"
  )
INSERT INTO "webhook_job" ("id", "created_at", "block_height", "webhook_id") 
VALUES (DEFAULT, DEFAULT, sqlc.arg('latest_block_height'), (SELECT "id" FROM inserted_webhook));

-- name: RescheduleWebhookJob :execrows
WITH webhook_jobs_with_same_blockchain AS (
  -- Gets all webhook jobs that have a blockchain ID that's identical 
  -- to the job being rescheduled.
  SELECT "webhook_job"."id", "webhook_job"."block_height", "webhook"."blockchain_id"
  FROM "webhook_job"
  INNER JOIN "webhook" ON "webhook"."id" = "webhook_job"."webhook_id"
  WHERE "webhook"."blockchain_id" IN (
    SELECT "webhook"."blockchain_id" AS "id"
    FROM "webhook_job"
    INNER JOIN "webhook" ON "webhook"."id" = "webhook_job"."webhook_id"
    WHERE "webhook_job"."id" = sqlc.arg('id')
    LIMIT 1
  )
),
clean_block_cache AS (
  -- To clean the cache we first need to filter out the blocks that 
  -- are associated with the same chain as job being rescheduled. Once
  -- we know which blocks these are, we find the job with the smallest 
  -- block height, and any cached block that has a height smaller than 
  -- this is no longer going to be queried and can safely be deleted.  
  DELETE FROM "block_cache"
  WHERE "block_cache"."blockchain_id" IN (
    SELECT DISTINCT "blockchain_id" 
    FROM webhook_jobs_with_same_blockchain
  )
  AND "block_cache"."block_height" < (
    SELECT MIN("block_height")
    FROM webhook_jobs_with_same_blockchain
  )
),
deleted_job AS (
  -- Deletes the webhook job so that we can generate a new auto-
  -- incrementing ID for it
  DELETE FROM "webhook_job" WHERE "id" = sqlc.arg('id') RETURNING "webhook_id" 
)
-- Creates a new job with an updated block height 
INSERT INTO "webhook_job" ("id", "created_at", "block_height", "webhook_id") 
VALUES (DEFAULT, DEFAULT, sqlc.arg('block_height'), (SELECT "webhook_id" FROM deleted_job))
ON CONFLICT ("webhook_id") DO NOTHING;

-- name: GetWebhookJobByWebhookID :one
SELECT * FROM "webhook_job" WHERE "webhook_id" = sqlc.arg('webhook_id');

-- name: GetWebhookJobs :many
SELECT 
  "webhook_job"."id" AS "id",
  "webhook"."id" AS "webhook_id",
  "webhook"."max_retries" AS "webhook_max_retries"
FROM "webhook_job"
INNER JOIN "webhook" ON "webhook"."id" = "webhook_job"."webhook_id"
WHERE "webhook_job"."id" > sqlc.arg('cursor_id')
ORDER BY "webhook_job"."id" ASC
LIMIT sqlc.arg('limit');

-- name: GetWebhookJob :one
SELECT 
  "webhook_job"."id" AS "id",
  "webhook"."id" AS "webhook_id",
  "webhook"."url" AS "webhook_url",
  "webhook"."timeout_ms" AS "webhook_timeout_ms",
  (
    SELECT array_agg("block")::JSONB[] 
    FROM "block_cache" 
    WHERE "block_cache"."blockchain_id" = "webhook"."blockchain_id"
    AND "block_cache"."block_height" >= "webhook_job"."block_height"
    LIMIT "webhook"."max_blocks"
  ) AS "cached_blocks"
FROM "webhook_job"
INNER JOIN "webhook" ON "webhook"."id" = "webhook_job"."webhook_id"
WHERE "webhook_job"."id" = sqlc.arg('id')
LIMIT 1;

-- name: UpsertBlockchain :execrows
INSERT INTO "blockchain" ("id", "url") 
VALUES (sqlc.arg('id'), sqlc.arg('url'))
ON CONFLICT ("id") DO UPDATE SET "url" = EXCLUDED."url";

-- name: GetLatestCachedBlockHeight :one
SELECT "blockchain_id", "block_height" 
FROM "block_cache" 
WHERE "blockchain_id" = sqlc.arg('blockchain_id')
ORDER BY "block_height" DESC
LIMIT 1;

-- name: CacheBlocks :copyfrom
INSERT INTO "block_cache" ("blockchain_id", "block_height", "block") 
VALUES (sqlc.arg('blockchain_id'), sqlc.arg('block_height'), sqlc.arg('block'));

