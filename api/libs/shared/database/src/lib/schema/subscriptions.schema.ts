import { webhookSubscriptions } from "./webhook-subscriptions.schema"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { emailSubscriptions } from "./email-subscriptions.schema"
import { uuid, timestamp, text } from "drizzle-orm/pg-core"
import { blockCursor } from "./block-cursor.schema"
import { blockFeed } from "./block-feed.schema"
import { relations } from "drizzle-orm"
import { users } from "./users.schema"

export const subscriptions = blockFeed.table("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  name: text("name").unique().notNull(),
  cursorId: text("cursor_id")
    .notNull()
    .references(() => blockCursor.id, {
      onDelete: "cascade",
    }),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
})

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  webhookSubscription: one(webhookSubscriptions, {
    fields: [subscriptions.id],
    references: [webhookSubscriptions.subscriptionId],
  }),
  emailSubscription: one(emailSubscriptions, {
    fields: [subscriptions.id],
    references: [emailSubscriptions.subscriptionId],
  }),
  blockCursor: one(blockCursor, {
    fields: [subscriptions.cursorId],
    references: [blockCursor.id],
  }),
}))

export const selectSubscriptionsSchema = createSelectSchema(subscriptions)
export const insertSubscriptionsSchema = createInsertSchema(subscriptions)
