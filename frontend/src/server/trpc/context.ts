import type { CreateNextContextOptions } from "@trpc/server/adapters/next"
import { db } from "@block-feed/server/vendor/database"
import { redis } from "@block-feed/server/vendor/redis"
import { auth } from "@block-feed/server/vendor/auth0"
import { z } from "zod"

export const zEnv = z.object({
  WEBHOOK_REDIS_STREAM_NAME: z.string().min(1),
})

export type InnerContext = Readonly<{
  redis: ReturnType<typeof redis.client.create>
  auth: ReturnType<typeof auth.client.create>
  db: ReturnType<typeof db.client.create>
  env: z.infer<typeof zEnv>
}>

export type Context = ReturnType<ReturnType<typeof createContext>>

export const createContext =
  (innerCtx: InnerContext) => (nextCtx: CreateNextContextOptions) => {
    return {
      ...nextCtx,
      inner: innerCtx,
    }
  }
