import {
  mysqlTable,
  mysqlSchema,
  AnyMySqlColumn,
  primaryKey,
  varchar,
  datetime,
  int,
  text,
  foreignKey,
  unique,
  index,
  tinyint,
} from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const blockchain = mysqlTable(
  "blockchain",
  {
    id: varchar("id", { length: 255 }).notNull(),
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    shardCount: int("shard_count").notNull(),
    url: text("url").notNull(),
    pgStoreUrl: text("pg_store_url").notNull(),
    redisStoreUrl: text("redis_store_url").notNull(),
    redisClusterUrl: text("redis_cluster_url").notNull(),
    redisStreamUrl: text("redis_stream_url").notNull(),
  },
  (table) => {
    return {
      blockchainId: primaryKey({ columns: [table.id], name: "blockchain_id" }),
    }
  },
)

export const checkoutSession = mysqlTable(
  "checkout_session",
  {
    id: varchar("id", { length: 36 }).notNull(),
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    clientReferenceId: varchar("client_reference_id", { length: 36 }).notNull(),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    customerId: varchar("customer_id", { length: 255 })
      .notNull()
      .references(() => customer.id),
    url: text("url").notNull(),
  },
  (table) => {
    return {
      checkoutSessionId: primaryKey({
        columns: [table.id],
        name: "checkout_session_id",
      }),
      clientReferenceId: unique("client_reference_id").on(
        table.clientReferenceId,
      ),
      customerId: unique("customer_id").on(table.customerId),
    }
  },
)

export const customer = mysqlTable(
  "customer",
  {
    id: varchar("id", { length: 255 }).notNull(),
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => {
    return {
      customerId: primaryKey({ columns: [table.id], name: "customer_id" }),
    }
  },
)

export const webhook = mysqlTable(
  "webhook",
  {
    id: varchar("id", { length: 36 }).notNull(),
    createdAt: datetime("created_at", { mode: "string" })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    isActive: tinyint("is_active").notNull(),
    url: text("url").notNull(),
    maxBlocks: int("max_blocks").notNull(),
    maxRetries: int("max_retries").notNull(),
    timeoutMs: int("timeout_ms").notNull(),
    customerId: varchar("customer_id", { length: 255 })
      .notNull()
      .references(() => customer.id),
    blockchainId: varchar("blockchain_id", { length: 255 })
      .notNull()
      .references(() => blockchain.id),
    shardId: int("shard_id").notNull(),
  },
  (table) => {
    return {
      customerId: index("customer_id").on(table.customerId),
      blockchainId: index("blockchain_id").on(table.blockchainId),
      webhookId: primaryKey({ columns: [table.id], name: "webhook_id" }),
      id: unique("id").on(table.id, table.createdAt),
    }
  },
)
