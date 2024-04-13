import { mysqlTable, mysqlSchema, AnyMySqlColumn, primaryKey, varchar, text, foreignKey, unique, datetime, index, tinyint, int } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"


export const blockchain = mysqlTable("blockchain", {
	id: varchar("id", { length: 255 }).notNull(),
	url: text("url").notNull(),
},
(table) => {
	return {
		blockchainId: primaryKey({ columns: [table.id], name: "blockchain_id"}),
	}
});

export const checkoutSession = mysqlTable("checkout_session", {
	id: varchar("id", { length: 36 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`CURRENT_TIMESTAMP`).notNull(),
	clientReferenceId: varchar("client_reference_id", { length: 36 }).notNull(),
	sessionId: varchar("session_id", { length: 255 }).notNull(),
	customerId: varchar("customer_id", { length: 255 }).notNull().references(() => customer.id),
	url: text("url").notNull(),
},
(table) => {
	return {
		checkoutSessionId: primaryKey({ columns: [table.id], name: "checkout_session_id"}),
		clientReferenceId: unique("client_reference_id").on(table.clientReferenceId),
		customerId: unique("customer_id").on(table.customerId),
	}
});

export const customer = mysqlTable("customer", {
	id: varchar("id", { length: 255 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => {
	return {
		customerId: primaryKey({ columns: [table.id], name: "customer_id"}),
	}
});

export const webhook = mysqlTable("webhook", {
	id: varchar("id", { length: 36 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`CURRENT_TIMESTAMP`).notNull(),
	isQueued: tinyint("is_queued").notNull(),
	isActive: tinyint("is_active").notNull(),
	url: text("url").notNull(),
	maxBlocks: int("max_blocks").notNull(),
	maxRetries: int("max_retries").notNull(),
	timeoutMs: int("timeout_ms").notNull(),
	customerId: varchar("customer_id", { length: 255 }).notNull().references(() => customer.id),
	blockchainId: varchar("blockchain_id", { length: 255 }).notNull().references(() => blockchain.id),
},
(table) => {
	return {
		blockchainId: index("blockchain_id").on(table.blockchainId),
		customerId: index("customer_id").on(table.customerId),
		webhookId: primaryKey({ columns: [table.id], name: "webhook_id"}),
		id: unique("id").on(table.id, table.createdAt),
	}
});

export const webhookClaim = mysqlTable("webhook_claim", {
	id: varchar("id", { length: 36 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`CURRENT_TIMESTAMP`).notNull(),
	claimedBy: varchar("claimed_by", { length: 255 }).notNull(),
	webhookId: varchar("webhook_id", { length: 36 }).notNull().references(() => webhook.id, { onDelete: "cascade" } ),
},
(table) => {
	return {
		webhookClaimId: primaryKey({ columns: [table.id], name: "webhook_claim_id"}),
		webhookId: unique("webhook_id").on(table.webhookId),
	}
});

export const webhookLocation = mysqlTable("webhook_location", {
	id: varchar("id", { length: 36 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`CURRENT_TIMESTAMP`).notNull(),
	webhookClaimId: varchar("webhook_claim_id", { length: 36 }).notNull().references(() => webhookClaim.id, { onDelete: "cascade" } ),
	webhookNodeId: varchar("webhook_node_id", { length: 36 }).notNull().references(() => webhookNode.id, { onDelete: "cascade" } ),
	webhookId: varchar("webhook_id", { length: 36 }).notNull().references(() => webhook.id, { onDelete: "cascade" } ),
},
(table) => {
	return {
		webhookClaimId: index("webhook_claim_id").on(table.webhookClaimId),
		webhookNodeId: index("webhook_node_id").on(table.webhookNodeId),
		webhookLocationId: primaryKey({ columns: [table.id], name: "webhook_location_id"}),
		webhookId: unique("webhook_id").on(table.webhookId),
		webhookId2: unique("webhook_id_2").on(table.webhookId, table.webhookNodeId),
	}
});

export const webhookNode = mysqlTable("webhook_node", {
	id: varchar("id", { length: 36 }).notNull(),
	createdAt: datetime("created_at", { mode: 'string'}).default(sql`CURRENT_TIMESTAMP`).notNull(),
	url: varchar("url", { length: 255 }).notNull(),
	blockchainId: varchar("blockchain_id", { length: 255 }).notNull().references(() => blockchain.id),
},
(table) => {
	return {
		blockchainId: index("blockchain_id").on(table.blockchainId),
		webhookNodeId: primaryKey({ columns: [table.id], name: "webhook_node_id"}),
		url: unique("url").on(table.url),
		url2: unique("url_2").on(table.url, table.blockchainId),
	}
});