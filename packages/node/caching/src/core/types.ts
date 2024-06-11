export interface AsyncCacheGetter<T> {
  get(key: string): Promise<T | null | undefined>
}

export interface AsyncCacheSetter<T> {
  set(key: string, val: T): Promise<void>
}

export interface AsyncCacheGetOrSet<T, P> {
  getOrSet(key: string, params: P): Promise<T>
}

export interface AsyncCacheInvalidator {
  invalidate(key: string): Promise<number>
}

export interface CacheSetAsyncCallback<T> {
  setCallback<P>(
    expirationMs: number,
    cb: (params: P) => Promise<T>,
  ): AsyncCallbackCache<T, P>
}

export type AsyncCache<T> = AsyncCacheGetter<T> &
  AsyncCacheInvalidator &
  CacheSetAsyncCallback<T>

export type AsyncCallbackCache<T, P> = AsyncCacheGetter<T> &
  AsyncCacheSetter<T> &
  AsyncCacheInvalidator &
  AsyncCacheGetOrSet<T, P>

export interface CacheGetter<T> {
  get(key: string): T | null | undefined
}

export interface CacheSetter<T> {
  set(key: string, val: T): void
}

export interface CacheGetOrSet<T, P> {
  getOrSet(key: string, params: P): T
}

export interface CacheInvalidator {
  invalidate(key: string): number
}

export interface CacheSetCallback<T> {
  setCallback<P>(cb: (params: P) => T): CallbackCache<T, P>
}

export type BaseCache<T> = CacheGetter<T> &
  CacheInvalidator &
  CacheSetCallback<T>

export type CallbackCache<T, P> = CacheGetter<T> &
  CacheSetter<T> &
  CacheInvalidator &
  CacheGetOrSet<T, P>
