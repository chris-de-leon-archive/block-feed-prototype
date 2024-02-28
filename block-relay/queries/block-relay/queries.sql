-- name: GetWebhook :one
SELECT * FROM `webhook` WHERE `id` = sqlc.arg('id');

-- name: LockWebhook :one
SELECT * FROM `webhook` WHERE `id` = sqlc.arg('id') FOR UPDATE SKIP LOCKED;

-- name: ActivateWebhook :execrows
UPDATE `webhook` SET `is_active` = true WHERE `id` = sqlc.arg('id');

-- name: ClaimWebhook :execrows
INSERT IGNORE INTO `webhook_claim` (`id`, `created_at`, `claimed_by`, `webhook_id`)
VALUES (UUID(), DEFAULT, sqlc.arg('claimed_by'), sqlc.arg('webhook_id'));

-- name: FindClaimedWebhook :one
SELECT sqlc.embed(webhook_claim), sqlc.embed(webhook)
FROM `webhook_claim` 
LEFT JOIN `webhook` ON `webhook`.`id` = `webhook_claim`.`webhook_id`
WHERE `webhook_id` = sqlc.arg('webhook_id') 
LIMIT 1;

-- name: UpsertBlockchain :execrows
INSERT IGNORE INTO `blockchain` (`id`, `url`) 
VALUES (sqlc.arg('id'), sqlc.arg('url'))
ON DUPLICATE KEY UPDATE `url` = VALUES(`url`);

-- name: CountWebhookNodes :one
SELECT COUNT(*) FROM `webhook_node`;

-- name: LockWebhookNode :one
SELECT `webhook_node`.* 
FROM `webhook_node`
LEFT JOIN (
  -- counts the number of webhooks each node is processing
  SELECT `webhook_node_id`, COUNT(*) AS `node_weight` 
  FROM `webhook_location`
  GROUP BY `webhook_node_id`
) AS `t` 
ON `t`.`webhook_node_id` = `webhook_node`.`id`
WHERE `webhook_node`.`blockchain_id` = sqlc.arg('blockchain_id')
ORDER BY 
  `node_weight` IS NULL DESC, -- make sure nulls appear at the beginning
  `node_weight` ASC -- then sort in ascending order for non-null rows
LIMIT 1 
FOR UPDATE SKIP LOCKED;

-- name: LocateWebhook :one
SELECT `webhook_node`.* 
FROM `webhook_node`
WHERE `webhook_node`.`id` IN (
  SELECT `webhook_node_id`
  FROM `webhook_location`
  WHERE `webhook_location`.`webhook_id` = sqlc.arg('webhook_id') 
)
AND `webhook_node`.`blockchain_id` = sqlc.arg('blockchain_id')
LIMIT 1;

-- name: AssignWebhookToNode :execrows
INSERT IGNORE INTO `webhook_location` (`id`, `created_at`, `webhook_claim_id`, `webhook_node_id`, `webhook_id`)
VALUES (UUID(), DEFAULT, sqlc.arg('webhook_claim_id'), sqlc.arg('webhook_node_id'), sqlc.arg('webhook_id'));
