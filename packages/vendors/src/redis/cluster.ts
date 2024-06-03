import { scripts } from "./scripts"
import { Redis } from "ioredis"
import { z } from "zod"

export type RedisClusterVendor = ReturnType<typeof create>

export const zEnv = z.object({
  REDIS_CLUSTER_URL: z.string().url(),
})

export const create = (env: z.infer<typeof zEnv>) => {
  const client = new Redis.Cluster([env.REDIS_CLUSTER_URL], {
    scripts,
  })

  return {
    client,
    env,
  }
}
