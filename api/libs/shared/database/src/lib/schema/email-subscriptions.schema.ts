import { timestamp, integer, boolean, uuid, text } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { backoffStrategyEnum } from "./enums/backoff-strategy.enum"
import { subscriptions } from "./subscriptions.schema"
import { blockFeed } from "./block-feed.schema"
import { relations } from "drizzle-orm"

export const emailSubscriptions = blockFeed.table("email_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  email: text("email").notNull(),
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

export const emailSubscriptionsRelations = relations(
  emailSubscriptions,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [emailSubscriptions.subscriptionId],
      references: [subscriptions.id],
    }),
  })
)

export const selectEmailSubscriptionsSchema =
  createSelectSchema(emailSubscriptions)
export const insertEmailSubscriptionsSchema =
  createInsertSchema(emailSubscriptions)
