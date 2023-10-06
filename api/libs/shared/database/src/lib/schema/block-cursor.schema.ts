import { timestamp, text, uniqueIndex } from "drizzle-orm/pg-core"
import { blockchainEnum } from "./enums/blockchain.enum"
import { subscriptions } from "./subscriptions.schema"
import { blockFeed } from "./block-feed.schema"
import { relations } from "drizzle-orm"

export const blockCursor = blockFeed.table(
  "block_cursor",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    blockchain: blockchainEnum("blockchain").notNull(),
    networkURL: text("network_url").notNull(),
  },
  (table) => {
    return {
      oneCursorPerChainAndNetworkUniqueIndex: uniqueIndex(
        "one_primary_cursor_per_chain_unique_index"
      )
        .on(table.blockchain, table.networkURL)
        .concurrently(),
    }
  }
)

export const blockCursorRelations = relations(blockCursor, ({ many }) => ({
  subscriptions: many(subscriptions),
}))
