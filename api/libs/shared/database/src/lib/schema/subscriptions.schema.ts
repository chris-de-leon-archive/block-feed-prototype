import { uuid, timestamp, text, uniqueIndex } from "drizzle-orm/pg-core"
import { webhookSubscriptions } from "./webhook-subscriptions.schema"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { emailSubscriptions } from "./email-subscriptions.schema"
import { blockchains } from "./blockchains.schema"
import { blockFeed } from "./block-feed.schema"
import { relations } from "drizzle-orm"
import { users } from "./users.schema"

export const subscriptions = blockFeed.table(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    name: text("name").unique().notNull(),
    chainId: text("chain_id")
      .notNull()
      .references(() => blockchains.id, {
        onDelete: "cascade",
      }),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
  },
  (t) => {
    return {
      // Each user should only be able to create one subscription per cursor
      one_sub_per_cursor_per_user: uniqueIndex().on(t.userId, t.chainId),
    }
  }
)

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  webhookSubscription: one(webhookSubscriptions, {
    fields: [subscriptions.id],
    references: [webhookSubscriptions.subscriptionId],
  }),
  emailSubscription: one(emailSubscriptions, {
    fields: [subscriptions.id],
    references: [emailSubscriptions.subscriptionId],
  }),
  blockchain: one(blockchains, {
    fields: [subscriptions.chainId],
    references: [blockchains.id],
  }),
}))

export const selectSubscriptionsSchema = createSelectSchema(subscriptions)
export const insertSubscriptionsSchema = createInsertSchema(subscriptions)
