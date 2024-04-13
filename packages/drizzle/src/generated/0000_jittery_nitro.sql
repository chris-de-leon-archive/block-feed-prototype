-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `blockchain` (
	`id` varchar(255) NOT NULL,
	`url` text NOT NULL,
	CONSTRAINT `blockchain_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checkout_session` (
	`id` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`client_reference_id` varchar(36) NOT NULL,
	`session_id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`url` text NOT NULL,
	CONSTRAINT `checkout_session_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_reference_id` UNIQUE(`client_reference_id`),
	CONSTRAINT `customer_id` UNIQUE(`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `customer` (
	`id` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `customer_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook` (
	`id` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`is_queued` tinyint NOT NULL,
	`is_active` tinyint NOT NULL,
	`url` text NOT NULL,
	`max_blocks` int NOT NULL,
	`max_retries` int NOT NULL,
	`timeout_ms` int NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`blockchain_id` varchar(255) NOT NULL,
	CONSTRAINT `webhook_id` PRIMARY KEY(`id`),
	CONSTRAINT `id` UNIQUE(`id`,`created_at`)
);
--> statement-breakpoint
CREATE TABLE `webhook_claim` (
	`id` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`claimed_by` varchar(255) NOT NULL,
	`webhook_id` varchar(36) NOT NULL,
	CONSTRAINT `webhook_claim_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_id` UNIQUE(`webhook_id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_location` (
	`id` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`webhook_claim_id` varchar(36) NOT NULL,
	`webhook_node_id` varchar(36) NOT NULL,
	`webhook_id` varchar(36) NOT NULL,
	CONSTRAINT `webhook_location_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_id` UNIQUE(`webhook_id`),
	CONSTRAINT `webhook_id_2` UNIQUE(`webhook_id`,`webhook_node_id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_node` (
	`id` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`url` varchar(255) NOT NULL,
	`blockchain_id` varchar(255) NOT NULL,
	CONSTRAINT `webhook_node_id` PRIMARY KEY(`id`),
	CONSTRAINT `url` UNIQUE(`url`),
	CONSTRAINT `url_2` UNIQUE(`url`,`blockchain_id`)
);
--> statement-breakpoint
CREATE INDEX `blockchain_id` ON `webhook` (`blockchain_id`);--> statement-breakpoint
CREATE INDEX `customer_id` ON `webhook` (`customer_id`);--> statement-breakpoint
CREATE INDEX `webhook_claim_id` ON `webhook_location` (`webhook_claim_id`);--> statement-breakpoint
CREATE INDEX `webhook_node_id` ON `webhook_location` (`webhook_node_id`);--> statement-breakpoint
CREATE INDEX `blockchain_id` ON `webhook_node` (`blockchain_id`);--> statement-breakpoint
ALTER TABLE `checkout_session` ADD CONSTRAINT `checkout_session_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook` ADD CONSTRAINT `webhook_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook` ADD CONSTRAINT `webhook_ibfk_2` FOREIGN KEY (`blockchain_id`) REFERENCES `blockchain`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_claim` ADD CONSTRAINT `webhook_claim_ibfk_1` FOREIGN KEY (`webhook_id`) REFERENCES `webhook`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_location` ADD CONSTRAINT `webhook_location_ibfk_1` FOREIGN KEY (`webhook_claim_id`) REFERENCES `webhook_claim`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_location` ADD CONSTRAINT `webhook_location_ibfk_2` FOREIGN KEY (`webhook_node_id`) REFERENCES `webhook_node`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_location` ADD CONSTRAINT `webhook_location_ibfk_3` FOREIGN KEY (`webhook_id`) REFERENCES `webhook`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_node` ADD CONSTRAINT `webhook_node_ibfk_1` FOREIGN KEY (`blockchain_id`) REFERENCES `blockchain`(`id`) ON DELETE no action ON UPDATE no action;
*/