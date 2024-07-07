import { redis } from "@block-feed/node-providers-redis"
import Stripe from "stripe"
import { z } from "zod"
import {
  AsyncCallbackCache,
  createRedisCache,
  makeCacheKey,
  AsyncCache,
} from "@block-feed/node-caching"

export const zMetadata = z.object({
  userId: z.string(),
})

export const zEnv = z.object({
  STRIPE_API_KEY: z.string().min(1),
})

export class Provider {
  public readonly client: Stripe

  constructor(public readonly env: z.infer<typeof zEnv>) {
    this.client = new Stripe(env.STRIPE_API_KEY)
  }

  public get constants() {
    return {
      STREAMING: {
        WEBHOOK_EVENT_STREAM_NAME: "block-feed:stripe:webhook-event",
        EVENT_FIELD: "event",
      },
    }
  }

  public static createCheckoutSessionCache(
    stripeProvider: Provider,
    redisProvider: redis.Provider,
    expirationMs: number,
  ): AsyncCallbackCache<Stripe.Checkout.Session, string>
  public static createCheckoutSessionCache(
    stripeProvider: Provider,
    redisProvider: redis.Provider,
  ): AsyncCache<Stripe.Checkout.Session>
  public static createCheckoutSessionCache(
    stripeProvider: Provider,
    redisProvider: redis.Provider,
    expirationMs?: number,
  ) {
    const cache = createRedisCache<Stripe.Checkout.Session>(
      redisProvider.client,
      makeCacheKey("stripe", "checkout", "session"),
    )

    if (expirationMs != null) {
      return cache.setCallback(expirationMs, async (sessionId: string) => {
        return await stripeProvider.client.checkout.sessions.retrieve(
          sessionId,
          {
            expand: ["subscription", "customer"],
          },
        )
      })
    }

    return cache
  }

  public parseMetadata(obj: unknown) {
    return zMetadata.parse(obj)
  }

  public makeMetadata(
    metadata: z.infer<typeof zMetadata>,
  ): z.infer<typeof zMetadata> {
    return metadata
  }

  public async extractStripeSubscription(sess: Stripe.Checkout.Session) {
    if (sess.subscription == null) {
      return null
    }

    // If the 'subscription' field is expanded when retrieving a
    // checkout session, then this code will never execute and an
    // additional API call will not be made
    if (typeof sess.subscription === "string") {
      return await this.client.subscriptions.retrieve(sess.subscription)
    }

    return sess.subscription
  }

  public async extractStripeCustomer(sess: Stripe.Checkout.Session) {
    if (sess.customer == null) {
      return null
    }

    // If the 'customer' field is expanded when retrieving a
    // checkout session, then this code will never execute and an
    // additional API call will not be made
    if (typeof sess.customer === "string") {
      return await this.client.customers.retrieve(sess.customer)
    }

    return sess.customer
  }
}
