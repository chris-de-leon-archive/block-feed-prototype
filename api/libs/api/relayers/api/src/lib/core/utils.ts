import { V1Deployment } from "@kubernetes/client-node"
import { database } from "@api/shared/database"
import { api } from "@api/api/core"
import { z } from "zod"

export const getImageNameFromRelayer = (
  relayer: z.infer<typeof database.schema.zSelectRelayersSchema>,
  env: ReturnType<typeof api.core.getEnvVars>,
) => {
  const map: Record<
    database.schema.Blockchains,
    Record<database.schema.RelayerTransports, string>
  > = {
    [database.schema.Blockchains.FLOW]: {
      [database.schema.RelayerTransports.HTTP]:
        env.API_FLOW_HTTP_RELAYER_DOCKER_IMAGE_TAG,
      [database.schema.RelayerTransports.SMTP]:
        env.API_FLOW_SMTP_RELAYER_DOCKER_IMAGE_TAG,
    },
    [database.schema.Blockchains.ETH]: {
      [database.schema.RelayerTransports.HTTP]:
        env.API_ETH_HTTP_RELAYER_DOCKER_IMAGE_TAG,
      [database.schema.RelayerTransports.SMTP]:
        env.API_ETH_SMTP_RELAYER_DOCKER_IMAGE_TAG,
    },
  }
  return map[relayer.chain][relayer.transport]
}

export const getK8sDeploymentConfig = (
  deployment: NonNullable<
    Awaited<ReturnType<typeof database.queries.deployments.findOne>>
  >,
  env: ReturnType<typeof api.core.getEnvVars>,
): V1Deployment => {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: deployment.id,
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: deployment.name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: deployment.name,
          },
        },
        spec: {
          containers: deployment.relayers.map((r) => ({
            name: r.name,
            image: getImageNameFromRelayer(r, env),
            env: Object.entries(r.options).map(([k, v]) => ({
              name: k,
              value: v.toString(),
            })),
          })),
        },
      },
    },
  }
}
