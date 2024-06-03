import * as redisClusterClient from "./cluster"
import * as redisClient from "./client"

export type { RedisClusterVendor } from "./cluster"
export type { RedisVendor } from "./client"

export const redis = {
  cluster: redisClusterClient,
  client: redisClient,
}
