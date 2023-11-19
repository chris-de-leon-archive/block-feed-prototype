import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      AUTH0_CLIENT_SECRET: z.string().min(1),
      AUTH0_CLIENT_ID: z.string().min(1),
      AUTH0_DOMAIN: z.string().min(1),
    })
    .parse(process.env)
