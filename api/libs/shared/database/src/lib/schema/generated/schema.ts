import { pgTable, pgSchema, text, foreignKey, uuid, timestamp, integer, unique, bigint, bigserial, primaryKey, jsonb } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"


export const blockFeed = pgSchema("block_feed");

export const blockchain = blockFeed.table("blockchain", {
	id: text("id").primaryKey().notNull(),
	url: text("url").notNull(),
});

export const webhook = blockFeed.table("webhook", {
	id: uuid("id").default(sql`block_feed.uuid_generate_v4()`).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	url: text("url").notNull(),
	maxBlocks: integer("max_blocks").notNull(),
	maxRetries: integer("max_retries").notNull(),
	timeoutMs: integer("timeout_ms").notNull(),
	customerId: text("customer_id").notNull().references(() => customer.id),
	blockchainId: text("blockchain_id").notNull().references(() => blockchain.id),
});

export const blockCursor = blockFeed.table("block_cursor", {
	id: text("id").primaryKey().notNull(),
	blockchainId: text("blockchain_id").notNull().references(() => blockchain.id),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	blockHeight: bigint("block_height", { mode: "number" }).notNull(),
},
(table) => {
	return {
		uniqueBlockHeightPerChain: unique("unique_block_height_per_chain").on(table.blockchainId, table.blockHeight),
	}
});

export const customer = blockFeed.table("customer", {
	id: text("id").primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const webhookJob = blockFeed.table("webhook_job", {
	id: bigserial("id", { mode: "bigint" }).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	blockHeight: bigint("block_height", { mode: "number" }).notNull(),
	webhookId: uuid("webhook_id").notNull().references(() => webhook.id, { onDelete: "cascade" } ),
},
(table) => {
	return {
		webhookJobWebhookIdKey: unique("webhook_job_webhook_id_key").on(table.webhookId),
	}
});

export const blockCache = blockFeed.table("block_cache", {
	blockchainId: text("blockchain_id").notNull().references(() => blockchain.id),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	blockHeight: bigint("block_height", { mode: "number" }).notNull(),
	block: jsonb("block").notNull(),
},
(table) => {
	return {
		blockCachePkey: primaryKey({ columns: [table.blockchainId, table.blockHeight], name: "block_cache_pkey"})
	}
});