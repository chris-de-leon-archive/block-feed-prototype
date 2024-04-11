import * as createBillingPortalSession from "./handlers/create-billing-portal-session"
import * as createCheckoutSession from "./handlers/create-checkout-session"
import { gqlStripeSession, gqlStripeSubscription } from "./models"
import * as stripeSubscription from "./handlers/subscription"
import { builder } from "@block-feed/server/graphql/builder"

builder.mutationField("createCheckoutSession", (t) =>
  t.field({
    type: gqlStripeSession,
    args: {},
    validate: {
      schema: createCheckoutSession.zInput,
    },
    resolve: async (_, args, ctx) => {
      return await createCheckoutSession.handler(args, ctx)
    },
  }),
)

builder.mutationField("createBillingPortalSession", (t) =>
  t.field({
    type: gqlStripeSession,
    args: {},
    validate: {
      schema: createBillingPortalSession.zInput,
    },
    resolve: async (_, args, ctx) => {
      const subscription = await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripe,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.auth0.user,
      })
      return await createBillingPortalSession.handler(args, {
        ...ctx,
        stripe: { subscription },
      })
    },
  }),
)

builder.queryField("stripeSubscription", (t) =>
  t.field({
    type: gqlStripeSubscription,
    args: {},
    validate: {
      schema: stripeSubscription.zInput,
    },
    resolve: async (_, args, ctx) => {
      const subscription = await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripe,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.auth0.user,
      })
      return await stripeSubscription.handler(args, {
        ...ctx,
        stripe: { subscription },
      })
    },
  }),
)
