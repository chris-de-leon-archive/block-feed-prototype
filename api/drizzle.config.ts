import { database } from "@api/shared/database"
import type { Config } from "drizzle-kit"

const env = database.core.getEnvVars()

export default {
  schema: [
    "./libs/shared/database/src/lib/schema/**/*.schema.ts",
    "./libs/shared/database/src/lib/schema/**/*.enum.ts",
  ],
  out: `./drizzle/migrations/${process.env["DB_MIGRATIONS_FOLDER"] ?? ""}`,
  schemaFilter: ["public", database.schema.blockFeed.schemaName],
  verbose: true,
  driver: "pg",
  dbCredentials: {
    connectionString: env.DB_URL,
  },
} satisfies Config
