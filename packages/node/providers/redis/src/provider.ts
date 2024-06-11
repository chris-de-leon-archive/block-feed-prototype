import { scripts } from "./scripts"
import { Redis } from "ioredis"
import { z } from "zod"

export const zEnv = z.object({
  REDIS_URL: z.string().url().optional(),
})

export class Provider {
  public readonly client: Redis

  constructor(public readonly env: z.infer<typeof zEnv>) {
    if (env.REDIS_URL == null) {
      throw new Error("REDIS_URL is not defined")
    }

    this.client = new Redis(env.REDIS_URL, {
      scripts,
    })
  }
}
