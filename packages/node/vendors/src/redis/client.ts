import { scripts } from "./scripts"
import { Redis } from "ioredis"
import { z } from "zod"

export type RedisVendor = ReturnType<typeof create>

export const zEnv = z.object({
  REDIS_URL: z.string().url().optional(),
})

export const create = (env: z.infer<typeof zEnv>) => {
  if (env.REDIS_URL == null) {
    throw new Error("REDIS_URL is not defined")
  }

  const client = new Redis(env.REDIS_URL, {
    scripts,
  })

  return {
    client,
    env,
  }
}
