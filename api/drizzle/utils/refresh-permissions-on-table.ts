import { NodePgQueryResultHKT } from "drizzle-orm/node-postgres"
import { ExtractTablesWithRelations } from "drizzle-orm"
import { PgTransaction } from "drizzle-orm/pg-core"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"

export const refreshPermissionsOnTable = async (
  tx: PgTransaction<
    NodePgQueryResultHKT,
    typeof database.schema,
    ExtractTablesWithRelations<typeof database.schema>
  >,
  username: string,
  schemaName: string,
  tableName: string,
  permissions: ("SELECT" | "INSERT" | "UPDATE" | "DELETE")[]
) => {
  const schema = sql.identifier(schemaName)
  const table = sql.identifier(tableName)
  const uname = sql.identifier(username)
  await tx.execute(
    sql`REVOKE ALL PRIVILEGES ON ${schema}.${table} FROM ${uname};`
  )
  await tx.execute(
    sql`GRANT ${sql.join(
      permissions.map((p) => sql.raw(`${p}`)),
      sql`,`
    )} ON TABLE ${schema}.${table} TO ${uname};`
  )
}
