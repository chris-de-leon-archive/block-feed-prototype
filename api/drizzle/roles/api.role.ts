import { refreshPermissionsOnTable } from "../utils/refresh-permissions-on-table"
import { createUserIfNotExists } from "../utils/create-user-if-not-exists"
import { ExtractTablesWithRelations, getTableName } from "drizzle-orm"
import { MySqlTransaction } from "drizzle-orm/mysql-core"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"
import {
  MySql2PreparedQueryHKT,
  MySql2QueryResultHKT,
} from "drizzle-orm/mysql2"

export const refreshApiRole = async (
  tx: MySqlTransaction<
    MySql2QueryResultHKT,
    MySql2PreparedQueryHKT,
    typeof database.schema,
    ExtractTablesWithRelations<typeof database.schema>
  >,
  username: string,
  password: string,
) => {
  await createUserIfNotExists(tx, username, password)

  await Promise.allSettled([
    refreshPermissionsOnTable(
      tx,
      username,
      database.core.CONSTANTS.DATABASES.BLOCK_FEED,
      getTableName(database.schema.users),
      ["SELECT", "INSERT", "UPDATE"],
    ),
    refreshPermissionsOnTable(
      tx,
      username,
      database.core.CONSTANTS.DATABASES.BLOCK_FEED,
      getTableName(database.schema.relayers),
      ["SELECT", "INSERT", "UPDATE", "DELETE"],
    ),
  ]).then(utils.throwIfError)
}
