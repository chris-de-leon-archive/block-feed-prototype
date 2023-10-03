import { NodePgDatabase, drizzle } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { Client } from "pg"

export const withConnection = async (
  cb: (
    ctx: Readonly<{
      db: NodePgDatabase<typeof database.schema>
      env: ReturnType<typeof database.core.getEnvVars>
    }>
  ) => Promise<void> | void
) => {
  const env = database.core.getEnvVars()

  const client = new Client({
    connectionString: env.DB_URL,
  })

  try {
    await client.connect()

    const db = drizzle(client, {
      logger: true,
      schema: database.schema,
    })

    await cb({ db, env })
  } finally {
    await client.end()
  }
}
