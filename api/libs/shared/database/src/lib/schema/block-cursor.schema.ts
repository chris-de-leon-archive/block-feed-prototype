import { timestamp, text, bigint, uniqueIndex } from "drizzle-orm/pg-core"
import { blockchainEnum } from "./enums/blockchain.enum"
import { blockFeed } from "./block-feed.schema"
import { relations } from "drizzle-orm"
import { funcs } from "./funcs.schema"

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
    height: bigint("height", { mode: "number" }).notNull(),
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
  funcs: many(funcs),
}))
