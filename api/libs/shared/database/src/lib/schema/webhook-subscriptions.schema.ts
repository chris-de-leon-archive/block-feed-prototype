import { timestamp, boolean, integer, uuid, text } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { backoffStrategyEnum } from "./enums/backoff-strategy.enum"
import { subscriptions } from "./subscriptions.schema"
import { blockFeed } from "./block-feed.schema"
import { relations } from "drizzle-orm"

export const webhookSubscriptions = blockFeed.table("webhook_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  url: text("url").notNull(),
  attempts: integer("attempts").notNull(),
  backoffDelayMS: integer("backoff_delay_ms").notNull(),
  backoffStrategy: backoffStrategyEnum("backoff_strategy").notNull(),
  isActive: boolean("is_active").notNull(),
  subscriptionId: uuid("subscription_id")
    .references(() => subscriptions.id, {
      onDelete: "cascade",
    })
    .notNull(),
})

export const webhookSubscriptionsRelations = relations(
  webhookSubscriptions,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [webhookSubscriptions.subscriptionId],
      references: [subscriptions.id],
    }),
  })
)

export const selectWebhookSubscriptionsSchema =
  createSelectSchema(webhookSubscriptions)
export const insertWebhookSubscriptionsSchema =
  createInsertSchema(webhookSubscriptions)
