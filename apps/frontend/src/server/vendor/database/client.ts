import { drizzle } from "drizzle-orm/mysql2"
import * as schema from "./schema"
import * as mysql from "mysql2"
import { z } from "zod"

export const zEnv = z.object({
  DB_LOGGING: z.boolean().default(false),
  DB_MODE: z.enum(["default", "planetscale"]),
  DB_URL: z.string().url(),
})

export const create = (env: z.infer<typeof zEnv>) => {
  const pool = mysql.createPool({
    uri: env.DB_URL,
  })

  return {
    drizzle: drizzle<typeof schema>(pool, {
      logger: env.DB_LOGGING,
      mode: env.DB_MODE,
      schema,
    }),
    pool,
  }
}
