CREATE TABLE `deployments` (
	`id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`name` varchar(253) NOT NULL,
	`namespace` varchar(253) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	CONSTRAINT `deployments_id` PRIMARY KEY(`id`),
	CONSTRAINT `deployments_user_id_name_unique` UNIQUE(`user_id`,`name`)
);

CREATE TABLE `relayers` (
	`id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`name` varchar(255) NOT NULL,
	`blockchain` enum('FLOW','ETH') NOT NULL,
	`relayer_transport` enum('HTTP','SMTP') NOT NULL,
	`options` json NOT NULL,
	`deployment_id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	CONSTRAINT `relayers_id` PRIMARY KEY(`id`),
	CONSTRAINT `relayers_name_unique` UNIQUE(`name`)
);

CREATE TABLE `users` (
	`id` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);

ALTER TABLE `deployments` ADD CONSTRAINT `deployments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `relayers` ADD CONSTRAINT `relayers_deployment_id_deployments_id_fk` FOREIGN KEY (`deployment_id`) REFERENCES `deployments`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `relayers` ADD CONSTRAINT `relayers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;

