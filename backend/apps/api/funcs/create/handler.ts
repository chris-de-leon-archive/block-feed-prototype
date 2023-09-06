import { database } from "../../../../libs/shared/database"
import { auth0 } from "../../../../libs/shared/auth0"
import { trpc } from "../../../../libs/shared/trpc"
import { funcsAPI } from "../../../../libs/api"

// https://orm.drizzle.team/docs/performance#serverless-environments
const services: trpc.types.ContextServices = {
  database: database.createClient(),
  auth0: auth0.createClient(),
}

export const handler = trpc.createHandler(services, (t) => {
  return t.router({
    [funcsAPI.NAMESPACE]: t.router(funcsAPI.create(t)),
  })
})
