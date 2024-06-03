-- name: CustomersCreate :execrows
INSERT INTO `customer` (`id`, `created_at`) VALUES (sqlc.arg('id'), DEFAULT);

