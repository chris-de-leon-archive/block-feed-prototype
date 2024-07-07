import { relations } from "drizzle-orm/relations"
import { customer, checkoutSession, webhook, blockchain } from "./schema"

export const checkoutSessionRelations = relations(
  checkoutSession,
  ({ one }) => ({
    customer: one(customer, {
      fields: [checkoutSession.customerId],
      references: [customer.id],
    }),
  }),
)

export const customerRelations = relations(customer, ({ many }) => ({
  checkoutSessions: many(checkoutSession),
  webhooks: many(webhook),
}))

export const webhookRelations = relations(webhook, ({ one }) => ({
  customer: one(customer, {
    fields: [webhook.customerId],
    references: [customer.id],
  }),
  blockchain: one(blockchain, {
    fields: [webhook.blockchainId],
    references: [blockchain.id],
  }),
}))

export const blockchainRelations = relations(blockchain, ({ many }) => ({
  webhooks: many(webhook),
}))
