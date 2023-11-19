import { drizzle } from "drizzle-orm/mysql2"
import { getEnvVars } from "./get-env-vars"
import * as schema from "../schema"
import * as mysql from "mysql2"

export const createClient = (
  opts: Partial<ReturnType<typeof getEnvVars>> = {},
) => {
  const env = getEnvVars()

  const pool = mysql.createPool({
    uri: opts.DB_URL ?? env.DB_URL,
  })

  return {
    drizzle: drizzle<typeof schema>(pool, {
      logger: opts.DB_LOGGING ?? env.DB_LOGGING,
      mode: opts.DB_MODE ?? env.DB_MODE,
      schema,
    }),
    pool,
  }
}
