import { rediscluster } from "@block-feed/node-providers-redis"
import { createLruCache } from "../core/lru.cache"
import { z } from "zod"

export class LruCacheFactory {
  public static readonly DEFAULT_CAPACITY = 100

  public static createRedisClusterConnCache(
    capacity = LruCacheFactory.DEFAULT_CAPACITY,
  ) {
    return createLruCache<rediscluster.Provider>(capacity).setCallback(
      (env: z.infer<typeof rediscluster.zEnv>) =>
        new rediscluster.Provider(env),
    )
  }
}
