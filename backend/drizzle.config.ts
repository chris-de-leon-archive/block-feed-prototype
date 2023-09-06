import { database } from "./libs/shared/database"
import type { Config } from "drizzle-kit"

const { url } = database.getEnvVars()

export default {
  schema: "./libs/shared/database/core/schema.ts",
  out: "./drizzle/migrations",
  schemaFilter: ["public", database.schema.blockFeed.schemaName],
  verbose: true,
  driver: "pg",
  dbCredentials: {
    connectionString: url,
  },
} satisfies Config
