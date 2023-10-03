import { withConnection } from "drizzle/utils/with-connection"
import { migrate } from "drizzle-orm/node-postgres/migrator"

withConnection(async ({ db }) => {
  await migrate(db, {
    migrationsFolder: `./drizzle/migrations/${
      process.env["DB_MIGRATIONS_FOLDER"] ?? ""
    }`,
  })
})
