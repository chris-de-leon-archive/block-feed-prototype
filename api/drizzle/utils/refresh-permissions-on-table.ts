import { MySqlTransaction } from "drizzle-orm/mysql-core"
import { ExtractTablesWithRelations } from "drizzle-orm"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"
import {
  MySql2PreparedQueryHKT,
  MySql2QueryResultHKT,
} from "drizzle-orm/mysql2"

export const refreshPermissionsOnTable = async (
  tx: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    typeof database.schema,
    ExtractTablesWithRelations<typeof database.schema>
  >,
  username: string,
  dbName: string,
  tableName: string,
  permissions: ("SELECT" | "INSERT" | "UPDATE" | "DELETE")[],
) => {
  const table = sql.identifier(tableName)
  const uname = sql.identifier(username)
  const db = sql.identifier(dbName)
  await tx.execute(
    sql`REVOKE IF EXISTS ALL PRIVILEGES ON ${db}.${table} FROM ${uname};`,
  )
  await tx.execute(
    sql`GRANT ${sql.join(
      permissions.map((p) => sql.raw(`${p}`)),
      sql`,`,
    )} ON TABLE ${db}.${table} TO ${uname};`,
  )
}
