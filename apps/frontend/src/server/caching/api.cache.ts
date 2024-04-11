import { redis } from "../vendor/redis"

export class ApiCache<T> {
  constructor(
    private readonly cache: ReturnType<typeof redis.client.create>,
    private readonly expirationMs: number,
    private readonly keyPrefix = "",
  ) {}

  private getPrefixedKey = (key: string) => {
    return this.keyPrefix.concat(`:${key}`)
  }

  public getOrSet = async (key: string, cb: () => Promise<T> | T) => {
    const cached = await this.get(key)
    const data = cached ?? (await cb())
    if (cached == null) {
      await this.set(key, data)
    }
    return data
  }

  public set = async (key: string, val: T) => {
    const cacheKey = this.getPrefixedKey(key)
    const data = JSON.stringify(val)
    await this.cache.client.set(cacheKey, data, "PX", this.expirationMs)
  }

  public get = async (key: string): Promise<T | null> => {
    const cacheKey = this.getPrefixedKey(key)
    const val = await this.cache.client.get(cacheKey)
    if (val != null) {
      return JSON.parse(val) as T
    }
    return null
  }

  public invalidate = async (key: string) => {
    const cacheKey = this.getPrefixedKey(key)
    await this.cache.client.del(cacheKey)
  }
}
