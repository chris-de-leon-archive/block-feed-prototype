import { gqlCursorPaginationInput } from "@block-feed/server/graphql/inputs"
import { gqlCount, gqlUUID } from "@block-feed/server/graphql/models"
import { builder } from "@block-feed/server/graphql/builder"
import { gqlWebhook, gqlWebhooks } from "./models"
import * as findMany from "./handlers/find-many"
import * as activate from "./handlers/activate"
import * as findOne from "./handlers/find-one"
import * as create from "./handlers/create"
import * as remove from "./handlers/remove"
import * as update from "./handlers/update"
import {
  gqlWebhookFiltersInput,
  gqlWebhookCreateInput,
  gqlWebhookUpdateInput,
} from "./inputs"

builder.queryField("webhook", (t) =>
  t.field({
    type: gqlWebhook,
    args: {
      id: t.arg.string({ required: true }),
    },
    validate: {
      schema: findOne.zInput,
    },
    resolve: async (_, args, ctx) => {
      await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripe,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.auth0.user,
      })
      return await findOne.handler(args, ctx)
    },
  }),
)

builder.queryField("webhooks", (t) =>
  t.field({
    type: gqlWebhooks,
    args: {
      filters: t.arg({
        type: gqlWebhookFiltersInput,
        required: true,
      }),
      pagination: t.arg({
        type: gqlCursorPaginationInput,
        required: true,
      }),
    },
    validate: {
      schema: findMany.zInput,
    },
    resolve: async (_, args, ctx) => {
      await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripe,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.auth0.user,
      })
      return await findMany.handler(args, ctx)
    },
  }),
)

builder.mutationField("webhookCreate", (t) =>
  t.field({
    type: gqlUUID,
    args: {
      data: t.arg({
        type: gqlWebhookCreateInput,
        required: true,
      }),
    },
    validate: {
      schema: create.zInput,
    },
    resolve: async (_, args, ctx) => {
      await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripe,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.auth0.user,
      })
      return await create.handler(args, ctx)
    },
  }),
)

builder.mutationField("webhookUpdate", (t) =>
  t.field({
    type: gqlCount,
    args: {
      id: t.arg.string({ required: true }),
      data: t.arg({
        type: gqlWebhookUpdateInput,
        required: true,
      }),
    },
    validate: {
      schema: update.zInput,
    },
    resolve: async (_, args, ctx) => {
      await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripe,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.auth0.user,
      })
      return await update.handler(args, ctx)
    },
  }),
)

builder.mutationField("webhookRemove", (t) =>
  t.field({
    type: gqlCount,
    args: {
      ids: t.arg.stringList({ required: true }),
    },
    validate: {
      schema: remove.zInput,
    },
    resolve: async (_, args, ctx) => {
      await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripe,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.auth0.user,
      })
      return await remove.handler(args, ctx)
    },
  }),
)

builder.mutationField("webhookActivate", (t) =>
  t.field({
    type: gqlCount,
    args: {
      ids: t.arg.stringList({ required: true }),
    },
    validate: {
      schema: activate.zInput,
    },
    resolve: async (_, args, ctx) => {
      await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripe,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.auth0.user,
      })
      return await activate.handler(args, ctx)
    },
  }),
)
