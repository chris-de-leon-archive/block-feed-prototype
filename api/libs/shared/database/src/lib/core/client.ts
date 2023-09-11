import { drizzle } from "drizzle-orm/node-postgres"
import { getEnvVars } from "./get-env-vars"
import { Pool } from "pg"

export const createClient = () => {
  const { url } = getEnvVars()

  const pool = new Pool({
    connectionString: url,
  })

  const database = drizzle(pool, {
    logger: process.env["NODE_ENV"] !== "production",
  })

  return database
}
