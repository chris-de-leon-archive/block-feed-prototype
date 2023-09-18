import { timestamp, text } from "drizzle-orm/pg-core"
import { blockFeed } from "./block-feed.schema"

export const users = blockFeed.table("users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})
