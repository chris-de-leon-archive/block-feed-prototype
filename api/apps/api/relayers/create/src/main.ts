import { AppsV1Api, KubeConfig } from "@kubernetes/client-node"
import { createOpenApiAwsLambdaHandler } from "trpc-openapi"
import { RelayersAPI } from "@api/api/relayers/api"
import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { trpc } from "@api/shared/trpc"

const t = trpc.createTRPC<RelayersAPI.CreateContext>()

// https://orm.drizzle.team/docs/performance#serverless-environments
const ctx: RelayersAPI.CreateContext = {
  database: database.core.createClient(),
  auth0: auth0.createClient(),
  k8s: (() => {
    // TODO: create helper function
    const kubeconfig = new KubeConfig()
    kubeconfig.loadFromDefault()
    return kubeconfig.makeApiClient(AppsV1Api)
  })(),
}

export const handler = createOpenApiAwsLambdaHandler({
  createContext: trpc.createContext(ctx),
  router: t.router({
    [RelayersAPI.NAMESPACE]: t.router({
      [RelayersAPI.OPERATIONS.CREATE.NAME]: RelayersAPI.create(t),
    }),
  }),
})
