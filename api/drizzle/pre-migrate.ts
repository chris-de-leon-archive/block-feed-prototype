import { drizzle } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"
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

    await db.execute(
      sql`DROP SCHEMA IF EXISTS ${sql.identifier(
        database.schema.blockFeed.schemaName
      )} CASCADE`
    )
  } finally {
    await client.end()
  }
}

main()
