import { migrate } from "drizzle-orm/node-postgres/migrator"
import { drizzle } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { Client } from "pg"

const { url } = database.getEnvVars()

const client = new Client({
  connectionString: url,
})

async function main() {
  await client.connect()

  await migrate(drizzle(client), {
    migrationsFolder: "./drizzle/migrations",
  })
}

main().finally(() => client.end())
