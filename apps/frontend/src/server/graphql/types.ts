import { redis } from "@block-feed/server/vendor/redis"
import { db } from "@block-feed/server/vendor/database"
import { auth } from "@block-feed/server/vendor/auth0"
import { YogaInitialContext } from "graphql-yoga"
import { UserInfoResponse } from "auth0"

export type Context = Readonly<{
  redisWebhookLB: ReturnType<typeof redis.client.create>
  redisCache: ReturnType<typeof redis.client.create>
  auth: ReturnType<typeof auth.client.create>
  db: ReturnType<typeof db.client.create>
  yoga: YogaInitialContext
  env: Readonly<{
    REDIS_WEBHOOK_STREAM_NAME: string
    REDIS_CACHE_EXP_SEC: number
  }>
}>

export type AuthContext = Context &
  Readonly<{
    user: UserInfoResponse
  }>
