-- name: CreateWebhook :execrows
WITH inserted_user AS (
  INSERT INTO "customer" ("id", "created_at")
  VALUES (sqlc.arg('customer_id')::TEXT, DEFAULT)
  ON CONFLICT ("id") DO NOTHING
  RETURNING "id"
)
INSERT INTO "webhook" (
  "id",
  "chain_id",
  "url",
  "max_retries",
  "timeout_ms",
  "retry_delay_ms",
  "customer_id"
) VALUES (
  DEFAULT,
  sqlc.arg('chain_id'),
  sqlc.arg('url'),
  sqlc.arg('max_retries'),
  sqlc.arg('timeout_ms'),
  sqlc.arg('retry_delay_ms'),
  sqlc.arg('customer_id')
);

-- name: CreatePendingWebhookJob :copyfrom
INSERT INTO "pending_webhook_job" (
  "block_height",
  "chain_id",
  "chain_url",
  "channel_name"
) VALUES (
  sqlc.arg('block_height'),
  sqlc.arg('chain_id'),
  sqlc.arg('chain_url'),
  sqlc.arg('channel_name')
);

-- name: FindWebhookJobsGreaterThanID :many
SELECT * 
FROM "webhook_job"
WHERE "id" > sqlc.arg('id')
ORDER BY "id" ASC
LIMIT sqlc.arg('limit');

-- name: FindBlockCursor :one
SELECT *
FROM "block_cursor"
WHERE "id" = sqlc.arg('chain_id')
LIMIT 1;

-- name: UpsertBlockCursor :execrows
INSERT INTO "block_cursor" (
  "id",
  "block_height"
) VALUES (
  sqlc.arg('id'),
  sqlc.arg('block_height')
)
ON CONFLICT ("id") DO UPDATE SET "block_height" = EXCLUDED."block_height";

