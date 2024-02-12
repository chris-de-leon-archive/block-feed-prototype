-- name: GetWebhook :one
SELECT * FROM `webhook` WHERE `id` = sqlc.arg('id');

-- name: UpsertBlockchain :execrows
INSERT IGNORE INTO `blockchain` (`id`, `url`) 
VALUES (sqlc.arg('id'), sqlc.arg('url'))
ON DUPLICATE KEY UPDATE `url` = VALUES(`url`);


