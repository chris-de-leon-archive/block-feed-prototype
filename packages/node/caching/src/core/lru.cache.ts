import { BaseCache, CallbackCache } from "./types"

export function createLruCache<T>(capacity: number): BaseCache<T> {
  const cache = new Map<string, T>()

  const reinsert = (key: string, val: T) => {
    // Re-insert the key-value pair to update its position
    cache.delete(key)
    cache.set(key, val)
  }

  const invalidate = (key: string) => {
    return Number(cache.delete(key) ? 1 : 0)
  }

  const get = (key: string) => {
    const val = cache.get(key)
    if (val !== undefined) {
      reinsert(key, val)
    }
    return val
  }

  const setCallback = <P>(cb: (params: P) => T): CallbackCache<T, P> => {
    const getOrSet = (key: string, params: P) => {
      const cached = get(key)
      const data = cached ?? cb(params)
      if (cached == null) {
        set(key, data)
      }
      return data
    }

    const set = (key: string, val: T) => {
      // There's several cases to consider here:
      //
      // - The key already exists in the cache and we're at max capacity - in this case the existing key's position should be updated
      // - The key already exists in the cache and we're not at max capacity - in this case the existing key's position should be updated
      // - The key does not exist in the cache and we're at max capacity - in this case the LRU entry should be evicted and this key should be inserted
      // - The key does not exist in the cache and we're not at max capacity - in this case the key should be inserted
      //
      if (cache.size >= capacity && !cache.has(key)) {
        const leastRecentlyUsedKey = Array.from(cache.keys()).at(0)
        if (leastRecentlyUsedKey !== undefined) {
          cache.delete(leastRecentlyUsedKey)
        }
      }
      reinsert(key, val)
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
