import { createOpenApiAwsLambdaHandler } from "trpc-openapi"
import { WebhooksAPI } from "@api/api/webhooks/api"
import { db } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { redis } from "@api/shared/redis"
import { trpc } from "@api/shared/trpc"

const t = trpc.createTRPC<WebhooksAPI.ActivateContext>()

// https://orm.drizzle.team/docs/performance#serverless-environments
const ctx: WebhooksAPI.ActivateContext = {
  database: db.core.createClient(db.core.zDatabaseEnv.parse(process.env)),
  redis: redis.core.createClient(redis.core.zRedisEnv.parse(process.env)),
  auth0: auth0.core.createClient(auth0.core.zAuthEnv.parse(process.env)),
  env: WebhooksAPI.ActivateEnv.parse(process.env),
}

export const handler = createOpenApiAwsLambdaHandler({
  createContext: trpc.createContext(ctx),
  router: t.router({
    [WebhooksAPI.NAMESPACE]: t.router({
      [WebhooksAPI.OPERATIONS.ACTIVATE.NAME]: WebhooksAPI.activate(t),
    }),
  }),
})
