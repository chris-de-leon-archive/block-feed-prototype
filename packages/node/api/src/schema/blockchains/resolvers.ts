import * as findMany from "./handlers/find-many"
import { builder } from "../../graphql/builder"
import { gqlBlockchain } from "./models"

builder.queryField("blockchains", (t) =>
  t.field({
    type: [gqlBlockchain],
    args: {},
    validate: {
      schema: findMany.zInput,
    },
    resolve: async (_, args, ctx) => {
      await ctx.middlewares.requireStripeSubscription({
        cache: ctx.caches.stripeCheckoutSess,
        stripe: ctx.vendor.stripe,
        db: ctx.vendor.db,
        user: ctx.clerk.user,
      })
      return await findMany.handler(args, ctx)
    },
  }),
)
