import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      DRIZZLE_DB_MIGRATIONS_FOLDER: z.string().optional(),
      DRIZZLE_DB_API_USER_UNAME: z.string().min(1),
      DRIZZLE_DB_API_USER_PWORD: z.string().min(1),
      DRIZZLE_DB_MODE: z.enum(["default", "planetscale"]),
      DRIZZLE_DB_NAME: z.string().optional(),
      DRIZZLE_DB_URL: z.string().min(1),
    })
    .parse(process.env)
