import { MySqlTable, getTableConfig } from "drizzle-orm/mysql-core"
import { MySql2Database } from "drizzle-orm/mysql2"
import { database } from "@api/shared/database"
import { SQL, sql } from "drizzle-orm"

export const wipeDB = async (db: MySql2Database<typeof database.schema>) => {
  // Collects all the tables we need to truncate
  const tables: SQL<unknown>[] = []
  Object.values(database.schema).forEach((item) => {
    if (item instanceof MySqlTable) {
      const table = getTableConfig(item)
      const schma = table.schema
      const tname = table.name
      tables.push(
        sql`TRUNCATE ${
          schma != null
            ? sql`${sql.identifier(schma)}.${sql.identifier(tname)};`
            : sql`${sql.identifier(tname)};`
        }`,
      )
    }
  })

  // Truncates all tables
  const dbName = sql.identifier(database.core.CONSTANTS.DATABASES.BLOCK_FEED)
  const pName = sql.identifier("truncate_tables")
  await db
    .transaction(async (tx) => {
      await tx.execute(sql`DROP PROCEDURE IF EXISTS ${dbName}.${pName}`)
      await tx.execute(sql`
        CREATE PROCEDURE ${dbName}.${pName}()
        BEGIN
          SET FOREIGN_KEY_CHECKS = 0;
          ${sql.join(tables, sql`\n          `)}
          SET FOREIGN_KEY_CHECKS = 1;
        END;
      `)
      await tx.execute(sql`CALL ${dbName}.${pName}()`)
      await tx.execute(sql`DROP PROCEDURE IF EXISTS ${dbName}.${pName}`)
    })
    .catch((err) => {
      console.error(err)
      throw err
    })
}
