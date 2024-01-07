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
      // NOTE: instead of dropping and recreating this procedure before
      // every test, we can simply reuse it if it already exists. Also,
      // the npm test command should automatically wipe and re-migrate
      // the database before running all the test cases, so this should
      // be sufficient to have reliable test cases. The command to drop
      // the procedure is left here for reference:
      //
      //  await tx.execute(sql`DROP PROCEDURE IF EXISTS ${dbName}.${pName}`)
      //
      await tx.execute(sql`
        CREATE PROCEDURE IF NOT EXISTS ${dbName}.${pName}()
        BEGIN
          SET FOREIGN_KEY_CHECKS = 0;
          ${sql.join(tables, sql`\n          `)}
          SET FOREIGN_KEY_CHECKS = 1;
        END;
      `)
      await tx.execute(sql`CALL ${dbName}.${pName}()`)
    })
    .catch((err) => {
      console.error(err)
      throw err
    })
}
