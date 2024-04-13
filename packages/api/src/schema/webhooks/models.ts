import { WebhookStatus } from "@block-feed/shared"
import { builder } from "../../graphql/builder"
import { InferSelectModel } from "drizzle-orm"
import * as schema from "@block-feed/drizzle"

export const gqlWebhookStatusEnum = builder.enumType(WebhookStatus, {
  name: "WebhookStatus",
})

export const gqlWebhook =
  builder.objectRef<InferSelectModel<typeof schema.webhook>>("Webhook")

builder.objectType(gqlWebhook, {
  fields: (t) => ({
    id: t.exposeString("id"),
    createdAt: t.exposeString("createdAt"),
    isQueued: t.exposeInt("isQueued"),
    isActive: t.exposeInt("isActive"),
    url: t.exposeString("url"),
    maxBlocks: t.exposeInt("maxBlocks"),
    maxRetries: t.exposeInt("maxRetries"),
    timeoutMs: t.exposeInt("timeoutMs"),
    customerId: t.exposeString("customerId"),
    blockchainId: t.exposeString("blockchainId"),
  }),
})

export const gqlPaginationFlags = builder.objectRef<{
  hasNext: boolean
  hasPrev: boolean
}>("PaginationFlags")

builder.objectType(gqlPaginationFlags, {
  fields: (t) => ({
    hasNext: t.exposeBoolean("hasNext"),
    hasPrev: t.exposeBoolean("hasPrev"),
  }),
})

export const gqlWebhooks = builder.objectRef<{
  payload: InferSelectModel<typeof schema.webhook>[]
  pagination: typeof gqlPaginationFlags.$inferType
}>("Webhooks")

builder.objectType(gqlWebhooks, {
  fields: (t) => ({
    payload: t.expose("payload", {
      type: [gqlWebhook],
    }),
    pagination: t.expose("pagination", {
      type: gqlPaginationFlags,
    }),
  }),
})
