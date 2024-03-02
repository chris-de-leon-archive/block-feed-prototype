-- name: CreateCustomer :execrows
INSERT INTO `customer` (`id`, `created_at`) VALUES (sqlc.arg('id'), DEFAULT);

-- name: CreateWebhook :execrows
INSERT INTO `webhook` (`id`, `created_at`, `is_active`, `url`, `max_blocks`, `max_retries`, `timeout_ms`, `customer_id`, `blockchain_id`)
VALUES (sqlc.arg('id'), sqlc.arg('created_at'), sqlc.arg('is_active'), sqlc.arg('url'), sqlc.arg('max_blocks'), sqlc.arg('max_retries'), sqlc.arg('timeout_ms'), sqlc.arg('customer_id'), sqlc.arg('blockchain_id'));

-- name: CreateWebhookNodes :execrows
INSERT INTO `webhook_node` (`id`, `created_at`, `url`, `blockchain_id`) VALUES (sqlc.arg('id'), sqlc.arg('created_at'), sqlc.arg('url'), sqlc.arg('blockchain_id'));

