import { RelayersAPI } from "@api/api/relayers/api"
import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { trpc } from "@api/shared/trpc"

// https://orm.drizzle.team/docs/performance#serverless-environments
const services: RelayersAPI.Context = {
  database: database.core.createClient(),
  auth0: auth0.createClient(),
}

export const handler = trpc.createHandler<RelayersAPI.Context>(
  services,
  (t) => {
    return t.router({
      [RelayersAPI.NAMESPACE]: t.router(RelayersAPI.remove(t)),
    })
  },
)
