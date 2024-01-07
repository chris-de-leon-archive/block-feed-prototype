import { HttpError } from "@kubernetes/client-node"
import { Context, OPERATIONS } from "./constants"
import { getK8sDeploymentConfig } from "./utils"
import { database } from "@api/shared/database"
import { TRPCError } from "@trpc/server"
import { trpc } from "@api/shared/trpc"
import { k8s } from "@api/shared/k8s"
import { api } from "@api/api/core"
import { z } from "zod"

export const DeployInput = z.object({
  deploymentId: z.string().uuid(),
})

export const DeployOutput = z.object({
  id: z.string().nullable(),
})

export type DeployContext = Context &
  Readonly<{
    k8s: ReturnType<typeof k8s.createClient>
    env: Readonly<{
      api: ReturnType<typeof api.core.getEnvVars>
    }>
  }>

export const deploy = (t: ReturnType<typeof trpc.createTRPC<DeployContext>>) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.DEPLOY.METHOD,
        path: OPERATIONS.DEPLOY.PATH,
        protect: true,
      },
    })
    .input(DeployInput)
    .output(DeployOutput)
    .use(t.middleware(api.middleware.requireAuth))
    .mutation(async (params) => {
      // Fetches the deployment info from the database
      const deployment = await database.queries.deployments.findOne(
        params.ctx.database,
        {
          where: {
            id: params.input.deploymentId,
            userId: params.ctx.user.sub,
          },
        },
      )

      // Aborts the deployment if the details are not found
      if (deployment == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "deployment not found",
        })
      }

      // Aborts the deployment if there's nothing to deploy
      if (deployment.relayers.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "deployment contains no relayers",
        })
      }

      // Reads the existing deployment info
      const deploymentExists = await params.ctx.k8s.client
        .readNamespacedDeployment(deployment.name, deployment.namespace)
        .then(() => true)
        .catch((err) => {
          if (err instanceof HttpError) {
            if (err.statusCode === 404) {
              return false
            }
            console.error(err)
          }
          throw err
        })

      // Fetches the k8s config
      const config = getK8sDeploymentConfig(deployment, params.ctx.env.api)

      // If the deployment exists, update it. Otherwise, create a new namespaced deployment
      if (deploymentExists) {
        await params.ctx.k8s.client.patchNamespacedDeployment(
          deployment.name,
          deployment.namespace,
          config,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            // https://stackoverflow.com/a/63139804
            headers: {
              "Content-Type": "application/merge-patch+json",
            },
          },
        )
      } else {
        await params.ctx.k8s.client.createNamespacedDeployment(
          deployment.namespace,
          config,
        )
      }

      // Returns the deployment ID
      return { id: params.input.deploymentId }
    })
