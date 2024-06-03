-- name: WebhooksFindOne :one
SELECT * FROM `webhook` WHERE `id` = sqlc.arg('id') LIMIT 1;

