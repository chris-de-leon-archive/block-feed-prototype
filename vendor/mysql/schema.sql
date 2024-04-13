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
  `url` TEXT NOT NULL
);

CREATE TABLE `webhook` (
  `id` VARCHAR(36) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_queued` BOOLEAN NOT NULL, -- mainly for frontend rendering, has no significance on the backend
  `is_active` BOOLEAN NOT NULL, 
	`url` TEXT NOT NULL,
  `max_blocks` INT NOT NULL,
  `max_retries` INT NOT NULL,
  `timeout_ms` INT NOT NULL,
  `customer_id` VARCHAR(255) NOT NULL, 
  `blockchain_id` VARCHAR(255) NOT NULL,

  FOREIGN KEY (`customer_id`) REFERENCES `customer` (`id`),
  FOREIGN KEY (`blockchain_id`) REFERENCES `blockchain` (`id`),
  UNIQUE KEY (`id`, `created_at`)
);

CREATE TABLE `webhook_node` (
  `id` VARCHAR(36) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `url` VARCHAR(255) NOT NULL UNIQUE,
  `blockchain_id` VARCHAR(255) NOT NULL,

  FOREIGN KEY (`blockchain_id`) REFERENCES `blockchain` (`id`),

  -- each node should only process data for one chain
  UNIQUE KEY (`url`, `blockchain_id`)
);

CREATE TABLE `webhook_claim` (
  `id` VARCHAR(36) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `claimed_by` VARCHAR(255) NOT NULL,
  `webhook_id` VARCHAR(36) NOT NULL UNIQUE,

  FOREIGN KEY (`webhook_id`) REFERENCES `webhook` (`id`) ON DELETE CASCADE
);

CREATE TABLE `webhook_location` (
  `id` VARCHAR(36) PRIMARY KEY,
	`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `webhook_claim_id` VARCHAR(36) NOT NULL,
  `webhook_node_id` VARCHAR(36) NOT NULL,
  `webhook_id` VARCHAR(36) NOT NULL UNIQUE,
  
  FOREIGN KEY (`webhook_claim_id`) REFERENCES `webhook_claim` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`webhook_node_id`) REFERENCES `webhook_node` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`webhook_id`) REFERENCES `webhook` (`id`) ON DELETE CASCADE,

  -- Each webhook can only be located on exactly one node. The blockchain ID of the 
  -- webhook must match the blockchain ID of the node it is being assigned to. There 
  -- is a trigger to enforce that the blockchain IDs are the same before insertion.
  -- The database roles have also been configured to prevent updates to the blockchain
  -- ID column to prevent mismatches. This means that once a webhook is created for a 
  -- chain, its blockchain ID cannot be updated. Instead the webhook must be deleted 
  -- and recreated with the new blockchain ID.
  UNIQUE KEY (`webhook_id`, `webhook_node_id`)
);

