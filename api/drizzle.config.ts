import { getEnvVars } from "./drizzle/utils/get-env-vars"
import { defineConfig } from "drizzle-kit"

const env = getEnvVars()

export default defineConfig({
  schema: [
    "./libs/shared/database/src/lib/schema/**/*.schema.ts",
    "./libs/shared/database/src/lib/schema/**/*.enum.ts",
  ],
  out: env.DRIZZLE_DB_MIGRATIONS_FOLDER ?? "./drizzle/migrations",
  verbose: true,
  driver: "mysql2",
  dbCredentials: {
    uri: new URL(env.DRIZZLE_DB_NAME ?? "", env.DRIZZLE_DB_URL).href,
  },
})
