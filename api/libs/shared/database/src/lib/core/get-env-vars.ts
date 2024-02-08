import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      DB_LOGGING: z.boolean().default(false),
      DB_URL: z.string().url(),
    })
    .parse(process.env)
