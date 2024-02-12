CREATE TABLE `customer` (
  `id` VARCHAR(255) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `blockchain` (
  `id` VARCHAR(255) PRIMARY KEY,
  `url` VARCHAR(255) NOT NULL
);

CREATE TABLE `webhook` (
  `id` VARCHAR(36) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`url` VARCHAR(255) NOT NULL,
  `max_blocks` INT NOT NULL,
  `max_retries` INT NOT NULL,
  `timeout_ms` INT NOT NULL,
  `customer_id` VARCHAR(255) NOT NULL, 
  `blockchain_id` VARCHAR(255) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`),
  FOREIGN KEY (`blockchain_id`) REFERENCES `blockchain` (`id`)
);

