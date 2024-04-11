import { stripe } from "../vendor/stripe"
import Stripe from "stripe"
import { z } from "zod"

export const fromZodType = <T extends z.ZodType>(o: z.infer<T>) => o

export const zStripeCheckoutSessionMetadata = z.object({
  auth0Id: z.string(),
})

export const zStripeSubscriptionMetadata = z.object({
  auth0Id: z.string(),
})

export const zStripeCustomerMetadata = z.object({
  auth0Id: z.string(),
})

export const expandStripeSubscription = async (
  stripeCtx: ReturnType<typeof stripe.client.create>,
  sess: Stripe.Checkout.Session,
) => {
  if (sess.subscription == null) {
    return null
  }

  // If the 'subscription' field is expanded when retrieving a
  // checkout session, then this code will never execute and an
  // additional API call will not be made
  if (typeof sess.subscription === "string") {
    return await stripeCtx.client.subscriptions.retrieve(sess.subscription)
  }

  return sess.subscription
}

export const expandStripeCustomer = async (
  stripeCtx: ReturnType<typeof stripe.client.create>,
  sess: Stripe.Checkout.Session,
) => {
  if (sess.customer == null) {
    return null
  }

  // If the 'customer' field is expanded when retrieving a
  // checkout session, then this code will never execute and an
  // additional API call will not be made
  if (typeof sess.customer === "string") {
    return await stripeCtx.client.customers.retrieve(sess.customer)
  }

  return sess.customer
}
