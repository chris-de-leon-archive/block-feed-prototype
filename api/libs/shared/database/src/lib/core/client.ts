import { drizzle } from "drizzle-orm/node-postgres"
import { getEnvVars } from "./get-env-vars"
import * as schema from "../schema"
import { Pool } from "pg"

export const createClient = () => {
  const env = getEnvVars()

  const pool = new Pool({
    connectionString: env.DB_URL,
  })

  return drizzle(pool, {
    logger: process.env["NODE_ENV"] === "development",
    schema,
  })
}
