import { builder } from "@block-feed/server/graphql/builder"
import { gqlWebhookStatusEnum } from "./models"
import {
  gqlStringLikeFilterInput,
  gqlStringEqFilterInput,
} from "@block-feed/server/graphql/inputs"

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

export const gqlWebhookStatusFilterInput = builder.inputType(
  "WebhookStatusFilterInput",
  {
    fields: (t) => ({
      eq: t.field({
        type: gqlWebhookStatusEnum,
        required: false,
      }),
    }),
  },
)

export const gqlWebhookFiltersBodyInput = builder.inputType(
  "WebhookFiltersBodyInput",
  {
    fields: (t) => ({
      blockchain: t.field({
        type: gqlStringEqFilterInput,
        required: false,
      }),
      status: t.field({
        type: gqlWebhookStatusFilterInput,
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
