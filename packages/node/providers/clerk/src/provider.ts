import { clerkClient, User as ClerkUser } from "@clerk/clerk-sdk-node"
import { redis } from "@block-feed/node-providers-redis"
import { z } from "zod"
import {
  AsyncCallbackCache,
  createRedisCache,
  makeCacheKey,
  AsyncCache,
} from "@block-feed/node-caching"

export type User = Readonly<{
  id: string
}>

export const zEnv = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_RAW_JWT_KEY: z.string().min(1),
})

export class Provider {
  public readonly client: typeof clerkClient
  public readonly env: z.infer<typeof zEnv> & Readonly<{ JWT_KEY: string }>

  constructor(env: z.infer<typeof zEnv>) {
    // https://stackoverflow.com/q/75440884
    const { JWT_KEY } = JSON.parse(env.CLERK_RAW_JWT_KEY)
    if (JWT_KEY == null) {
      throw new Error(
        `failed to parse JWT_KEY from env: ${JSON.stringify(env, null, 2)}`,
      )
    }

    this.client = clerkClient
    this.env = {
      ...env,
      JWT_KEY,
    }
  }

  public static createClerkUsersCache(
    clerkProvider: Provider,
    redisProvider: redis.Provider,
    expirationMs: number,
  ): AsyncCallbackCache<ClerkUser, string>
  public static createClerkUsersCache(
    clerkProvider: Provider,
    redisProvider: redis.Provider,
  ): AsyncCache<ClerkUser>
  public static createClerkUsersCache(
    clerkProvider: Provider,
    redisProvider: redis.Provider,
    expirationMs?: number,
  ) {
    const cache = createRedisCache<User>(
      redisProvider.client,
      makeCacheKey("clerk", "users"),
    )

    if (expirationMs != null) {
      return cache.setCallback(expirationMs, async (userId: string) => {
        return await clerkProvider.client.users.getUser(userId)
      })
    }

    return cache
  }
}
