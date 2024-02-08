import { drizzle } from "drizzle-orm/node-postgres"
import { getEnvVars } from "./get-env-vars"
import * as schema from "../schema"
import { readFileSync } from "fs"
import { Pool } from "pg"

export const createClient = (
  opts: Partial<ReturnType<typeof getEnvVars>> = {},
) => {
  const env = getEnvVars()

  const pool = new Pool({
    connectionString: opts.DB_URL ?? env.DB_URL,
    // TODO: make sure this is included in the final serverless build
    ssl:
      process.env["NODE_ENV"] === "production"
        ? {
            ca: readFileSync("/root/.postgresql/root.crt"),
          }
        : undefined,
  })

  return {
    drizzle: drizzle<typeof schema>(pool, {
      logger: opts.DB_LOGGING ?? env.DB_LOGGING,
      schema,
    }),
    pool,
  }
}
