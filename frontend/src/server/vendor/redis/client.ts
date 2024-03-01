import { Redis } from "ioredis"
import { z } from "zod"

export const zEnv = z.object({
  REDIS_URL: z.string().url(),
})

export const create = (env: z.infer<typeof zEnv>) => {
  const redis = new Redis(env.REDIS_URL)

  return {
    client: redis,
  }
}
