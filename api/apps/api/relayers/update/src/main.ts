import { createOpenApiAwsLambdaHandler } from "trpc-openapi"
import { RelayersAPI } from "@api/api/relayers/api"
import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { trpc } from "@api/shared/trpc"

const t = trpc.createTRPC<RelayersAPI.Context>()

// https://orm.drizzle.team/docs/performance#serverless-environments
const ctx: RelayersAPI.Context = {
  database: database.core.createClient(),
  auth0: auth0.createClient(),
}

export const handler = createOpenApiAwsLambdaHandler({
  createContext: trpc.createContext(ctx),
  router: t.router({
    [RelayersAPI.NAMESPACE]: t.router({
      [RelayersAPI.OPERATIONS.UPDATE.NAME]: RelayersAPI.update(t),
    }),
  }),
})
