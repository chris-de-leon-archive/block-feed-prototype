import { builder } from "../../graphql/builder"
import {
  gqlStringLikeFilterInput,
  gqlStringEqFilterInput,
  gqlBoolEqFilterInput,
} from "../../graphql/inputs"

export const gqlWebhookUpdateInput = builder.inputType("WebhookUpdateInput", {
  fields: (t) => ({
    url: t.string({ required: false }),
    maxBlocks: t.int({ required: false }),
    maxRetries: t.int({ required: false }),
    timeoutMs: t.int({ required: false }),
  }),
})

export const gqlWebhookCreateInput = builder.inputType("WebhookCreateInput", {
  fields: (t) => ({
    url: t.string({ required: true }),
    maxBlocks: t.int({ required: true }),
    maxRetries: t.int({ required: true }),
    timeoutMs: t.int({ required: true }),
    blockchainId: t.string({ required: true }),
  }),
})

export const gqlWebhookFiltersBodyInput = builder.inputType(
  "WebhookFiltersBodyInput",
  {
    fields: (t) => ({
      blockchain: t.field({
        type: gqlStringEqFilterInput,
        required: false,
      }),
      isActive: t.field({
        type: gqlBoolEqFilterInput,
        required: false,
      }),
      url: t.field({
        type: gqlStringLikeFilterInput,
        required: false,
      }),
    }),
  },
)

export const gqlWebhookFiltersInput = builder.inputType("WebhookFiltersInput", {
  fields: (t) => ({
    and: t.field({
      type: gqlWebhookFiltersBodyInput,
      required: false,
    }),
  }),
})
