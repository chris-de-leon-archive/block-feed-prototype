import { withConnection } from "drizzle/utils/with-connection"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"

withConnection(async ({ db }) => {
  await db.execute(
    sql`DROP DATABASE IF EXISTS ${sql.identifier(
      database.core.CONSTANTS.DATABASES.BLOCK_FEED,
    )}`,
  )
  await db.execute(
    sql`CREATE DATABASE ${sql.identifier(
      database.core.CONSTANTS.DATABASES.BLOCK_FEED,
    )}`,
  )
})
