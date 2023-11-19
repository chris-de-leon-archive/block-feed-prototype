import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      AWS_SECRET_ACCESS_KEY: z.string().min(1),
      AWS_ACCESS_KEY_ID: z.string().min(1),
      AWS_ENDPOINT: z.string().optional(),
      AWS_REGION: z.string().min(1),
    })
    .parse(process.env)
