import { NodePgQueryResultHKT } from "drizzle-orm/node-postgres"
import { ExtractTablesWithRelations } from "drizzle-orm"
import { PgTransaction } from "drizzle-orm/pg-core"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"

export const refreshPermissionsOnSchema = async (
  tx: PgTransaction<
    NodePgQueryResultHKT,
    typeof database.schema,
    ExtractTablesWithRelations<typeof database.schema>
  >,
  username: string,
  schemaName: string
) => {
  const schema = sql.identifier(schemaName)
  const uname = sql.identifier(username)
  await tx.execute(
    sql`REVOKE ALL PRIVILEGES ON SCHEMA ${schema} FROM ${uname};`
  )
  await tx.execute(sql`GRANT USAGE ON SCHEMA ${schema} TO ${uname};`)
}
