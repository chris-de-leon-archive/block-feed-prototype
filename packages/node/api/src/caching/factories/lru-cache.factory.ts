import { RedisClusterVendor, redis } from "@block-feed/vendors"
import { createLruCache } from "../core/lru.cache"

export class LruCacheFactory {
  public static readonly DEFAULT_CAPACITY = 100

  public static createRedisClusterConnCache(
    capacity = LruCacheFactory.DEFAULT_CAPACITY,
  ) {
    return createLruCache<RedisClusterVendor>(capacity).setCallback(
      redis.cluster.create,
    )
  }
}
