CREATE TABLE `customer` (
  `id` VARCHAR(255) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `checkout_session` (
  `id` VARCHAR(36) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `client_reference_id` VARCHAR(36) NOT NULL UNIQUE,
  `session_id` VARCHAR(255) NOT NULL, -- this can be unique, but there's no benefit in adding the constraint
  `customer_id` VARCHAR(255) NOT NULL UNIQUE,
  `url` TEXT NOT NULL,

  FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`)
);

CREATE TABLE `blockchain` (
  `id` VARCHAR(255) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `shard_count` INT NOT NULL,
  `url` TEXT NOT NULL,
  `pg_store_url` TEXT NOT NULL,
  `redis_store_url` TEXT NOT NULL,
  `redis_cluster_url` TEXT NOT NULL,
  `redis_stream_url` TEXT NOT NULL
);

CREATE TABLE `webhook` (
  `id` VARCHAR(36) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` BOOLEAN NOT NULL, 
	`url` TEXT NOT NULL,
  `max_blocks` INT NOT NULL,
  `max_retries` INT NOT NULL,
  `timeout_ms` INT NOT NULL,
  `customer_id` VARCHAR(255) NOT NULL, 
  `blockchain_id` VARCHAR(255) NOT NULL,
  `shard_id` INT NOT NULL,

  FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`),
  FOREIGN KEY (`blockchain_id`) REFERENCES `blockchain` (`id`),

  UNIQUE KEY (`id`, `created_at`)
);

