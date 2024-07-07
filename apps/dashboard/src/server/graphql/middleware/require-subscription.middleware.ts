import { AsyncCallbackCache } from "@block-feed/node-caching"
import { stripe } from "@block-feed/node-providers-stripe"
import { mysql } from "@block-feed/node-providers-mysql"
import { clerk } from "@block-feed/node-providers-clerk"
import * as schema from "@block-feed/node-db"
import { eq } from "drizzle-orm"
import Stripe from "stripe"
import {
  gqlInvalidSubscriptionError,
  gqlInternalServerError,
  gqlNotSubscribedError,
} from "../errors"

export type RequireStripeSubscriptionContext = Readonly<{
  cache: AsyncCallbackCache<Stripe.Checkout.Session, string>
  stripe: stripe.Provider
  db: mysql.Provider
  user: clerk.User
}>

export const requireStripeSubscription = async (
  ctx: RequireStripeSubscriptionContext,
) => {
  // Queries the database for the authenticated user's stripe subscription data
  const apiSess = await ctx.db.drizzle.query.checkoutSession.findFirst({
    where: eq(schema.checkoutSession.customerId, ctx.user.id),
  })

  // If the user has not checked out yet, throw an error
  if (apiSess == null) {
    throw gqlNotSubscribedError("user is not subscribed")
  }

  // NOTE: Stripe does not guarantee webhook event ordering, so storing the subscription
  // status in our database could lead to issues. As a result, we need to query the API
  // directly for the latest session / subscription state: https://docs.stripe.com/webhooks#event-ordering
  //
  // NOTE: If the user's subscription changes in any way, then this cache entry should be
  // invalidated. Consider a situation where we cache a user's active subscription, but
  // shortly after it is cached, the user cancels their subscription. If we don't perform
  // any invalidation on their cached subscription info using webhooks, then they'll still
  // be able to access our service until the cache expires the entry.
  //
  // NOTE: ordering matters here - the customer object is only present on completed checkout
  // sessions
  const stripeCheckoutSess = await ctx.cache.getOrSet(
    ctx.user.id,
    apiSess.sessionId,
  )

  // If the user has not completed their checkout session, throw an error
  if (stripeCheckoutSess.status !== "complete") {
    throw gqlNotSubscribedError("user must complete checkout session")
  }

  // Gets the customer data from the checkout session - since we
  // expanded the customer, this will not result in an extra API call
  const customer = await ctx.stripe.extractStripeCustomer(stripeCheckoutSess)

  // If the checkout session is missing the customer data, then this is a bug
  if (customer == null) {
    throw gqlInternalServerError("could not obtain customer from session")
  }

  // If the user was deleted, they should purchase another subscription
  if (customer.deleted != null || customer.deleted) {
    throw gqlNotSubscribedError(
      "user has been deleted and must subscribe again",
    )
  }

  // Gets the subscription data from the checkout session - since we
  // expanded the subscription, this will not result in an extra API call
  const stripeSub =
    await ctx.stripe.extractStripeSubscription(stripeCheckoutSess)

  // If the checkout session is missing the subscription data, then this is a bug
  if (stripeSub == null) {
    throw gqlInternalServerError("could not obtain subscription from session")
  }

  // If the user canceled their subscription, then they need to purchase another one
  if (stripeSub.status === "canceled") {
    throw gqlNotSubscribedError("user has canceled their subscription")
  }

  // Check that the user's subscription is still valid
  if (stripeSub.status !== "trialing" && stripeSub.status !== "active") {
    throw gqlInvalidSubscriptionError("invalid subscription")
  }

  // Returns the user's subscription data
  return {
    data: stripeSub,
  }
}
