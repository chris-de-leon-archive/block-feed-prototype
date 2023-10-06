import { timestamp, integer, jsonb, text, uuid } from "drizzle-orm/pg-core"
import { subscriptions } from "./subscriptions.schema"
import { blockFeed } from "./block-feed.schema"

export const invocationLog = blockFeed.table("invocation_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id, {
      onDelete: "cascade",
    }),
  metadata: jsonb("metadata").notNull(),
})
