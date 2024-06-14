import { AsyncCache, AsyncCallbackCache } from "./types"
import { redis } from "@block-feed/node-providers-redis"
import { makeCacheKey } from "../utils"

export function createRedisCache<T>(
  redisProvider: redis.Provider,
  namespace: string,
): AsyncCache<T> {
  const prefixWithNamespace = (key: string) => {
    return namespace != null && namespace !== ""
      ? makeCacheKey(namespace, key)
      : key
  }

  const invalidate = async (key: string) => {
    return await redisProvider.client.del(prefixWithNamespace(key))
  }

  const get = async (key: string) => {
    const val = await redisProvider.client.get(prefixWithNamespace(key))
    if (val != null) {
      return JSON.parse(val) as T
    }
    return null
  }

  const setCallback = <P>(
    expirationMs: number,
    cb: (params: P) => Promise<T>,
  ): AsyncCallbackCache<T, P> => {
    const getOrSet = async (key: string, params: P) => {
      const cached = await get(key)
      const data = cached ?? (await cb(params))
      if (cached == null) {
        await set(key, data)
      }
      return data
    }

    const set = async (key: string, val: T) => {
      if (expirationMs != null) {
        await redisProvider.client.set(
          prefixWithNamespace(key),
          JSON.stringify(val),
          "PX",
          expirationMs,
        )
      } else {
        await redisProvider.client.set(
          prefixWithNamespace(key),
          JSON.stringify(val),
        )
      }
    }

    return {
      invalidate,
      getOrSet,
      set,
      get,
    }
  }

  return {
    setCallback,
    invalidate,
    get,
  }
}
