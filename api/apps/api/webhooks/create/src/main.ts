import { createOpenApiAwsLambdaHandler } from "trpc-openapi"
import { WebhooksAPI } from "@api/api/webhooks/api"
import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { trpc } from "@api/shared/trpc"

const t = trpc.createTRPC<WebhooksAPI.Context>()

// https://orm.drizzle.team/docs/performance#serverless-environments
const ctx: WebhooksAPI.Context = {
  database: database.core.createClient(),
  auth0: auth0.createClient(),
}

export const handler = createOpenApiAwsLambdaHandler({
  createContext: trpc.createContext(ctx),
  router: t.router({
    [WebhooksAPI.NAMESPACE]: t.router({
      [WebhooksAPI.OPERATIONS.CREATE.NAME]: WebhooksAPI.create(t),
    }),
  }),
})
