import { GraphQLStripeAuthContext } from "@block-feed/server/graphql/types"
import { z } from "zod"

export const zInput = z.object({})

export const handler = async (
  _: z.infer<typeof zInput>,
  ctx: GraphQLStripeAuthContext,
) => {
  return {
    id: ctx.stripe.subscription.data.id,
    status: ctx.stripe.subscription.data.status,
  }
}
