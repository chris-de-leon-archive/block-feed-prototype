import { GraphQLStripeAuthContext } from "../../../graphql/types"
import { z } from "zod"

export const zInput = z.object({})

export const handler = async (
  _: z.infer<typeof zInput>,
  ctx: GraphQLStripeAuthContext,
) => {
  const stripeCustomerId =
    typeof ctx.stripe.subscription.data.customer === "string"
      ? ctx.stripe.subscription.data.customer
      : ctx.stripe.subscription.data.customer.id

  return await ctx.providers.stripe.client.billingPortal.sessions
    .create({
      customer: stripeCustomerId,
      return_url: ctx.env.stripe.STRIPE_BILLING_PORTAL_RETURN_URL,
    })
    .then((sess) => {
      return { url: sess.url }
    })
}
