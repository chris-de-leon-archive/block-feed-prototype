import { AsyncCache, AsyncCallbackCache } from "../core/types"
import { stripe } from "@block-feed/node-providers-stripe"
import { redis } from "@block-feed/node-providers-redis"
import { clerk } from "@block-feed/node-providers-clerk"
import { createRedisCache } from "../core/redis.cache"
import { User } from "@clerk/clerk-sdk-node"
import { makeCacheKey } from "../utils"
import Stripe from "stripe"

export class RedisCacheFactory {
  public static readonly NAMESPACES = {
    CLERK: {
      USERS: makeCacheKey("clerk", "users"),
    },
    STRIPE: {
      CHECKOUT: { SESS: makeCacheKey("stripe", "checkout", "session") },
    },
  }

  private constructor() {}

  public static createCheckoutSessionCache(
    stripeProvider: stripe.Provider,
    redisProvider: redis.Provider,
    expirationMs: number,
  ): AsyncCallbackCache<Stripe.Checkout.Session, string>
  public static createCheckoutSessionCache(
    stripeProvider: stripe.Provider,
    redisProvider: redis.Provider,
  ): AsyncCache<Stripe.Checkout.Session>
  public static createCheckoutSessionCache(
    stripeProvider: stripe.Provider,
    redisProvider: redis.Provider,
    expirationMs?: number,
  ) {
    const cache = createRedisCache<Stripe.Checkout.Session>(
      redisProvider,
      RedisCacheFactory.NAMESPACES.STRIPE.CHECKOUT.SESS,
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

  public static createClerkUsersCache(
    clerkProvider: clerk.Provider,
    redisProvider: redis.Provider,
    expirationMs: number,
  ): AsyncCallbackCache<User, string>
  public static createClerkUsersCache(
    clerkProvider: clerk.Provider,
    redisProvider: redis.Provider,
  ): AsyncCache<User>
  public static createClerkUsersCache(
    clerkProvider: clerk.Provider,
    redisProvider: redis.Provider,
    expirationMs?: number,
  ) {
    const cache = createRedisCache<User>(
      redisProvider,
      RedisCacheFactory.NAMESPACES.CLERK.USERS,
    )

    if (expirationMs != null) {
      return cache.setCallback(expirationMs, async (userId: string) => {
        return await clerkProvider.client.users.getUser(userId)
      })
    }

    return cache
  }
}
