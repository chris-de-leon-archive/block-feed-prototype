import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      K8S_BASE_URL: z.string().url().optional(),
    })
    .parse(process.env)
