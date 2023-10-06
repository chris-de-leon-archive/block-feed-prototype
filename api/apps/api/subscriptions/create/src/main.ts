import { subscriptionsAPI } from "@api/api/subscriptions/api"
import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"

// https://orm.drizzle.team/docs/performance#serverless-environments
const services: subscriptionsAPI.Ctx = {
  database: database.core.createClient(api.getEnvVars().API_DB_URL),
  auth0: auth0.createClient(),
}

export const handler = trpc.createHandler<subscriptionsAPI.Ctx>(
  services,
  (t) => {
    return t.router({
      [subscriptionsAPI.NAMESPACE]: t.router(subscriptionsAPI.create(t)),
    })
  }
)
