import { z } from "zod"

export const getEnvVars = () =>
  z
    .object({
      TEST_DB_LOGGING: z
        .enum(["true", "false"])
        .transform((value) => value === "true"),
      TEST_DB_URL: z.string().min(1),
    })
    .parse(process.env)
