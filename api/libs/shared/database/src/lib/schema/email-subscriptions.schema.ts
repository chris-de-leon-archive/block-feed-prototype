import { uuid, timestamp, text, unique, integer } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { subscriptions } from "./subscriptions.schema"
import { blockFeed } from "./block-feed.schema"
import {
  subscriptionMethodEnum,
  SubscriptionMethod,
} from "./enums/subscription-method.enum"

// TODO: allow multiple email subscriptions to a parent subscription
// TODO: add an isActive feature
export const emailSubscriptions = blockFeed.table(
  "email_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    email: text("email").notNull(),
    attempts: integer("attempts").notNull(),
    method: subscriptionMethodEnum("subscription_method")
      .notNull()
      .default(SubscriptionMethod.EMAIL),
    subscriptionId: uuid("subscription_id")
      .references(() => subscriptions.id, {
        onDelete: "cascade",
      })
      .notNull(),
  },
  (t) => {
    return {
      unique_method_per_subscription: unique().on(t.subscriptionId, t.method),
    }
  }
)

export const selectEmailSubscriptionsSchema =
  createSelectSchema(emailSubscriptions)
export const insertEmailSubscriptionsSchema =
  createInsertSchema(emailSubscriptions)
