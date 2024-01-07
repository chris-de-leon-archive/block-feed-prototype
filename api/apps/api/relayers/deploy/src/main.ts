import { createOpenApiAwsLambdaHandler } from "trpc-openapi"
import { RelayersAPI } from "@api/api/relayers/api"
import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { trpc } from "@api/shared/trpc"
import { k8s } from "@api/shared/k8s"
import { api } from "@api/api/core"

const t = trpc.createTRPC<RelayersAPI.DeployContext>()

// https://orm.drizzle.team/docs/performance#serverless-environments
const ctx: RelayersAPI.DeployContext = {
  database: database.core.createClient(),
  auth0: auth0.createClient(),
  k8s: k8s.createClient(),
  env: {
    api: api.core.getEnvVars(),
  },
}

export const handler = createOpenApiAwsLambdaHandler({
  createContext: trpc.createContext(ctx),
  router: t.router({
    [RelayersAPI.NAMESPACE]: t.router({
      [RelayersAPI.OPERATIONS.DEPLOY.NAME]: RelayersAPI.deploy(t),
    }),
  }),
})
