import { withConnection } from "drizzle/utils/with-connection"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"

withConnection(async ({ db }) => {
  await db.execute(
    sql`DROP SCHEMA IF EXISTS ${sql.identifier(
      database.schema.blockFeed.schemaName
    )} CASCADE`
  )
})
