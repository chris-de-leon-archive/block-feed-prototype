import { timestamp, text, uniqueIndex } from "drizzle-orm/pg-core"
import { blockchainEnum } from "./enums/blockchain.enum"
import { subscriptions } from "./subscriptions.schema"
import { blockFeed } from "./block-feed.schema"
import { relations } from "drizzle-orm"

export const blockchains = blockFeed.table(
  "blockchains",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    name: blockchainEnum("name").notNull(),
    url: text("url").notNull(),
  },
  (table) => {
    return {
      uniqueNameAndUrl: uniqueIndex().on(table.name, table.url).concurrently(),
    }
  }
)

export const blockCursorRelations = relations(blockchains, ({ many }) => ({
  subscriptions: many(subscriptions),
}))
