import { withConnection } from "drizzle/utils/with-connection"
import { migrate } from "drizzle-orm/mysql2/migrator"

withConnection(async ({ db, env }) => {
  await migrate(db, {
    migrationsFolder:
      env.DRIZZLE_DB_MIGRATIONS_FOLDER ?? "./drizzle/migrations",
  })
})
