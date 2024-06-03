import { ClerkVendor, RedisVendor, StripeVendor } from "@block-feed/vendors"
import { AsyncCache, AsyncCallbackCache } from "../core/types"
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
    stripeVendor: StripeVendor,
    redisVendor: RedisVendor,
    expirationMs: number,
  ): AsyncCallbackCache<Stripe.Checkout.Session, string>
  public static createCheckoutSessionCache(
    stripeVendor: StripeVendor,
    redisVendor: RedisVendor,
  ): AsyncCache<Stripe.Checkout.Session>
  public static createCheckoutSessionCache(
    stripeVendor: StripeVendor,
    redisVendor: RedisVendor,
    expirationMs?: number,
  ) {
    const cache = createRedisCache<Stripe.Checkout.Session>(
      redisVendor,
      RedisCacheFactory.NAMESPACES.STRIPE.CHECKOUT.SESS,
    )

    if (expirationMs != null) {
      return cache.setCallback(expirationMs, async (sessionId: string) => {
        return await stripeVendor.client.checkout.sessions.retrieve(sessionId, {
          expand: ["subscription", "customer"],
        })
      })
    }

    return cache
  }

  public static createClerkUsersCache(
    clerkVendor: ClerkVendor,
    redisVendor: RedisVendor,
    expirationMs: number,
  ): AsyncCallbackCache<User, string>
  public static createClerkUsersCache(
    clerkVendor: ClerkVendor,
    redisVendor: RedisVendor,
  ): AsyncCache<User>
  public static createClerkUsersCache(
    clerkVendor: ClerkVendor,
    redisVendor: RedisVendor,
    expirationMs?: number,
  ) {
    const cache = createRedisCache<User>(
      redisVendor,
      RedisCacheFactory.NAMESPACES.CLERK.USERS,
    )

    if (expirationMs != null) {
      return cache.setCallback(expirationMs, async (userId: string) => {
        return await clerkVendor.client.users.getUser(userId)
      })
    }

    return cache
  }
}
