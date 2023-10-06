import { pgEnum } from "drizzle-orm/pg-core"

export enum SubscriptionMethod {
  WEBHOOK = "WEBHOOK",
  EMAIL = "EMAIL",
}

// TODO: https://github.com/drizzle-team/drizzle-orm/issues/669
export const subscriptionMethodEnum = pgEnum("subscription_method_enum", [
  SubscriptionMethod.WEBHOOK,
  ...Object.values(SubscriptionMethod),
])
