import { createContext, zEnv } from "@block-feed/server/trpc"
import { createOpenApiNextHandler } from "trpc-openapi"
import { redis } from "@block-feed/server/vendor/redis"
import { db } from "@block-feed/server/vendor/database"
import { auth } from "@block-feed/server/vendor/auth0"
import { router } from "@block-feed/server/routes"

const authentication = auth.client.create(auth.client.zEnv.parse(process.env))

const redisClient = redis.client.create(redis.client.zEnv.parse(process.env))

const database = db.client.create(db.client.zEnv.parse(process.env))

const envvars = zEnv.parse(process.env)

export default createOpenApiNextHandler({
  router,
  createContext: createContext({
    redis: redisClient,
    auth: authentication,
    db: database,
    env: envvars,
  }),
  onError: (opts) => {
    console.error(opts)
  },
})
