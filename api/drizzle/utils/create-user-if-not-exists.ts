import { MySqlTransaction } from "drizzle-orm/mysql-core"
import { ExtractTablesWithRelations } from "drizzle-orm"
import { database } from "@api/shared/database"
import { sql } from "drizzle-orm"
import {
  MySql2PreparedQueryHKT,
  MySql2QueryResultHKT,
} from "drizzle-orm/mysql2"

export const createUserIfNotExists = async (
  tx: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    typeof database.schema,
    ExtractTablesWithRelations<typeof database.schema>
  >,
  username: string,
  password: string,
) => {
  const uname = sql.identifier(username)
  const pword = sql.raw(password)
  return await tx.execute(
    sql`CREATE USER IF NOT EXISTS ${uname} IDENTIFIED BY '${pword}';`,
  )
}
