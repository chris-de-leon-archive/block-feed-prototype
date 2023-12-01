import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      API_FLOW_HTTP_RELAYER_DOCKER_IMAGE_TAG: z.string().min(1),
      API_FLOW_SMTP_RELAYER_DOCKER_IMAGE_TAG: z.string().min(1),
      API_ETH_HTTP_RELAYER_DOCKER_IMAGE_TAG: z.string().min(1),
      API_ETH_SMTP_RELAYER_DOCKER_IMAGE_TAG: z.string().min(1),
    })
    .parse(process.env)
