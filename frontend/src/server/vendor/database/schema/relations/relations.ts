import { webhook, webhookClaim, webhookLocation } from "../generated/schema"
import { relations } from "drizzle-orm"

export const webhookRelations = relations(webhook, ({ one }) => ({
  webhookClaim: one(webhookClaim, {
    fields: [webhook.id],
    references: [webhookClaim.webhookId],
  }),
  webhookLocation: one(webhookLocation, {
    fields: [webhook.id],
    references: [webhookLocation.webhookId],
  }),
}))
