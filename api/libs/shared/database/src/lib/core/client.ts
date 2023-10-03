import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "../schema"
import { readFileSync } from "fs"
import { Pool } from "pg"

export const createClient = (url: string) => {
  const pool = new Pool({
    connectionString: url,
    ssl:
      process.env["NODE_ENV"] === "production"
        ? {
            // https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNECT-SSLROOTCERT
            ca: readFileSync("/root/.postgresql/root.crt").toString(),
          }
        : undefined,
  })

  return drizzle(pool, {
    logger: process.env["DB_ENABLE_LOGGING"] === "true",
    schema,
  })
}
