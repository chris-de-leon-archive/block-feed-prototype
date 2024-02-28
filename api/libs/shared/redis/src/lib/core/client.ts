import { Redis } from "ioredis"
import { z } from "zod"

export const zRedisEnv = z.object({
  REDIS_URL: z.string().url(),
})

export const createClient = (env: z.infer<typeof zRedisEnv>) => {
  const redis = new Redis(env.REDIS_URL)

  return {
    client: redis,
  }
}
