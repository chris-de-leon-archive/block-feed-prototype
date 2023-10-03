import { database } from "@api/shared/database"
import { funcsAPI } from "@api/api/funcs/api"
import { auth0 } from "@api/shared/auth0"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"

// https://orm.drizzle.team/docs/performance#serverless-environments
const services: funcsAPI.FuncsCtx = {
  database: database.core.createClient(api.getEnvVars().API_DB_URL),
  auth0: auth0.createClient(),
}

export const handler = trpc.createHandler<funcsAPI.FuncsCtx>(services, (t) => {
  return t.router({
    [funcsAPI.NAMESPACE]: t.router(funcsAPI.findOne(t)),
  })
})
