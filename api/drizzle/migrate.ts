import { migrate } from "drizzle-orm/node-postgres/migrator"
import { drizzle } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { Client } from "pg"

const env = database.core.getEnvVars()

const client = new Client({
  connectionString: env.DB_URL,
})

const main = async () => {
  try {
    await client.connect()

    const db = drizzle(client, {
      logger: true,
      schema: database.schema,
    })

    await migrate(db, {
      migrationsFolder: "./drizzle/migrations",
    })
  } finally {
    await client.end()
  }
}

main()
