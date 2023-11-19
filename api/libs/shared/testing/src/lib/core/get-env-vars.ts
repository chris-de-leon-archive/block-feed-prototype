import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      TEST_API_URL: z.string().min(1),
      TEST_DB_URL: z.string().min(1),
    })
    .parse(process.env)
