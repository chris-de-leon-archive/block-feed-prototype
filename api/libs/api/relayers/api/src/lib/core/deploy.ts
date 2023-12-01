import { AppsV1Api } from "@kubernetes/client-node"
import { Context, OPERATIONS } from "./constants"
import { getK8sDeploymentConfig } from "./utils"
import { database } from "@api/shared/database"
import { TRPCError } from "@trpc/server"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const DeployInput = z.object({
  deploymentId: z.string().uuid(),
})

export const DeployOutput = z.object({
  id: z.string().nullable(),
})

export type DeployContext = Context &
  Readonly<{ env: ReturnType<typeof api.core.getEnvVars>; k8s: AppsV1Api }>

export const deploy = (t: ReturnType<typeof trpc.createTRPC<DeployContext>>) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.CREATE.METHOD,
        path: OPERATIONS.CREATE.PATH,
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
      const existingDeployment = await params.ctx.k8s.readNamespacedDeployment(
        deployment.id,
        deployment.namespace,
      )

      // Fetches the k8s config
      const config = getK8sDeploymentConfig(deployment, params.ctx.env)

      // If the deployment exists, update it. Otherwise, create a new namespaced deployment
      if (existingDeployment.response.statusCode === 200) {
        await params.ctx.k8s
          .patchNamespacedDeployment(
            deployment.id,
            deployment.namespace,
            config,
          )
          .then((result) => {
            if (result.response.statusCode !== 200) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "could not update namespaced deployment",
              })
            }
          })
      } else {
        await params.ctx.k8s
          .createNamespacedDeployment(deployment.namespace, config)
          .then((result) => {
            if (result.response.statusCode !== 200) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "could not create namespaced deployment",
              })
            }
          })
      }

      return { id: params.input.deploymentId }
    })
