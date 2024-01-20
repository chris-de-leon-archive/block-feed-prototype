-- name: FindManyUsers :many
SELECT * 
FROM `users`
ORDER BY 
  `created_at` DESC, 
  `id` DESC
LIMIT ?
OFFSET ?;
