import { AsyncCache, AsyncCallbackCache } from "./types"
import { makeCacheKey } from "../utils"
import { Redis } from "ioredis"

export function createRedisCache<T>(
  redisClient: Redis,
  namespace: string,
): AsyncCache<T> {
  const prefixWithNamespace = (key: string) => {
    return namespace != null && namespace !== ""
      ? makeCacheKey(namespace, key)
      : key
  }

  const invalidate = async (key: string) => {
    return await redisClient.del(prefixWithNamespace(key))
  }

  const get = async (key: string) => {
    const val = await redisClient.get(prefixWithNamespace(key))
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
      if (expirationMs == null) {
        await redisClient.set(prefixWithNamespace(key), JSON.stringify(val))
      } else {
        await redisClient.set(
          prefixWithNamespace(key),
          JSON.stringify(val),
          "PX",
          expirationMs,
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
