import { StripeWebhookEventHandler } from "../graphql/plugins/stripe-webhook.plugin"
import type { DatabaseVendor, StripeVendor } from "@block-feed/vendors"
import * as schema from "@block-feed/drizzle"
import { ApiCache } from "../caching"
import type { Stripe } from "stripe"
import { eq } from "drizzle-orm"
import {
  zStripeCheckoutSessionMetadata,
  zStripeSubscriptionMetadata,
} from "./stripe"

// NOTE: all handlers in this file are designed to be idempotent:
//
//  https://docs.stripe.com/webhooks#handle-duplicate-events
//
// NOTE: Any uncaught errors will result in a response status of 500
// being sent back to Stripe and the webhook handler being retried.
// All other caught errors are logged and intentionally not retried
// (most likely because retrying the handler won't make a difference
// and result in wasted effort).
//

type HandlerContext = Readonly<{
  stripe: StripeVendor
  cache: ApiCache<Stripe.Response<Stripe.Checkout.Session>>
  db: DatabaseVendor
}>

// TODO: use redis streams
export const handleStripeWebhookEvent: StripeWebhookEventHandler<
  HandlerContext
> = async (ctx, event) => {
  console.log(`received event: ${event.type}`)
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(ctx, event)
      break
    case "invoice.paid":
      await invalidateCachedSubscription(ctx, event)
      break
    case "invoice.payment_failed":
      await invalidateCachedSubscription(ctx, event)
      break
    case "invoice.payment_succeeded":
      await invalidateCachedSubscription(ctx, event)
      break
    case "invoice.upcoming":
      // TODO: send email
      break
    case "customer.deleted":
      await handleCustomerDeleted(ctx, event)
      break
    case "customer.subscription.deleted":
      await invalidateCachedSubscription(ctx, event)
      break
    case "customer.subscription.updated":
      await invalidateCachedSubscription(ctx, event)
      break
    case "customer.subscription.created":
      await invalidateCachedSubscription(ctx, event)
      break
    case "customer.subscription.resumed":
      await invalidateCachedSubscription(ctx, event)
      break
    case "customer.subscription.paused":
      await invalidateCachedSubscription(ctx, event)
      break
    case "customer.subscription.trial_will_end":
      // TODO: send email
      break
    default:
      // Unhandled event type
      console.log(`unhandled event type ${event.type}`)
      return
  }
}

const handleCheckoutSessionCompleted = async (
  ctx: HandlerContext,
  event: Stripe.Event,
) => {
  if (event.type === "checkout.session.completed") {
    const metadata = zStripeCheckoutSessionMetadata.safeParse(
      event.data.object.metadata ?? {},
    )
    if (!metadata.success) {
      console.error(
        `an error occurred while processing event: ${JSON.stringify(event, null, 2)}`,
      )
      console.error(
        `an error occurred while parsing checkout session metadata:`,
      )
      console.error(metadata.error)
      return
    }
    await ctx.cache.invalidate(metadata.data.auth0Id)
  }
}

const handleCustomerDeleted = async (
  ctx: HandlerContext,
  event: Stripe.Event,
) => {
  if (event.type === "customer.deleted") {
    const subscriptions = await ctx.stripe.client.subscriptions.list({
      customer: event.data.object.id,
      limit: 1,
    })

    const subscription = subscriptions.data.at(0)
    if (subscription == null) {
      console.log(
        `no subscriptions detected for user with ID "${event.data.object.id}"`,
      )
      return
    }

    const metadata = zStripeSubscriptionMetadata.safeParse(
      subscription.metadata,
    )
    if (!metadata.success) {
      console.error(
        `an error occurred while processing event: ${JSON.stringify(event, null, 2)}`,
      )
      console.error(
        `an error occurred while parsing subscription metadata: ${JSON.stringify(subscription, null, 2)}`,
      )
      console.error(metadata.error)
      return
    }

    await Promise.allSettled([
      ctx.cache.invalidate(metadata.data.auth0Id),
      ctx.db.drizzle.transaction(async (tx) => {
        await tx
          .delete(schema.checkoutSession)
          .where(eq(schema.checkoutSession.customerId, metadata.data.auth0Id))
      }),
    ]).then(handlePromiseSettledResults)
  }
}

const invalidateCachedSubscription = async (
  ctx: HandlerContext,
  event: Stripe.Event,
) => {
  const resolveSubscription = async (sub: string | Stripe.Subscription) => {
    if (typeof sub === "string") {
      return await ctx.stripe.client.subscriptions.retrieve(sub)
    }
    return sub
  }

  if (
    event.type === "customer.subscription.paused" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.resumed"
  ) {
    const metadata = zStripeSubscriptionMetadata.safeParse(
      event.data.object.metadata,
    )
    if (metadata.success) {
      await ctx.cache.invalidate(metadata.data.auth0Id)
    } else {
      console.error(
        `an error occurred while processing event: ${JSON.stringify(event, null, 2)}`,
      )
      console.error(`an error occurred while parsing subscription metadata:`)
      console.error(metadata.error)
    }
  }

  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed" ||
    event.type === "invoice.payment_succeeded"
  ) {
    const subscription = event.data.object.subscription
    if (subscription == null) {
      console.error(
        `subscription is missing in checkout session event:\n${JSON.stringify(event, null, 2)}`,
      )
    } else {
      const sub = await resolveSubscription(subscription)
      const metadata = zStripeSubscriptionMetadata.safeParse(sub.metadata)
      if (metadata.success) {
        await ctx.cache.invalidate(metadata.data.auth0Id)
      } else {
        console.error(
          `an error occurred while processing event: ${JSON.stringify(event, null, 2)}`,
        )
        console.error(`an error occurred while parsing subscription metadata:`)
        console.error(metadata.error)
      }
    }
  }
}

const handlePromiseSettledResults = (
  results: PromiseSettledResult<unknown>[],
) => {
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(result.reason)
    }
  })
}
