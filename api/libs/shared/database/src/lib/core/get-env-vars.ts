import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      DB_LOGGING: z.boolean().default(false),
      DB_MODE: z.enum(["default", "planetscale"]),
      DB_URL: z.string().min(1),
    })
    .parse(process.env)
