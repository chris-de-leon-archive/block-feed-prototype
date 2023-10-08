import { refreshPermissionsOnSchema } from "../utils/refresh-permissions-on-schema"
import { refreshPermissionsOnTable } from "../utils/refresh-permissions-on-table"
import { createRoleIfNotExists } from "../utils/create-role-if-not-exists"
import { ExtractTablesWithRelations, getTableName } from "drizzle-orm"
import { NodePgQueryResultHKT } from "drizzle-orm/node-postgres"
import { PgTransaction } from "drizzle-orm/pg-core"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"

export const refreshApiRole = async (
  tx: PgTransaction<
    NodePgQueryResultHKT,
    typeof database.schema,
    ExtractTablesWithRelations<typeof database.schema>
  >,
  username: string,
  password: string
) => {
  await createRoleIfNotExists(tx, username, password)

  await refreshPermissionsOnSchema(
    tx,
    username,
    database.schema.blockFeed.schemaName
  )

  await Promise.allSettled([
    refreshPermissionsOnTable(
      tx,
      username,
      database.schema.blockFeed.schemaName,
      getTableName(database.schema.users),
      ["SELECT", "INSERT"]
    ),
    refreshPermissionsOnTable(
      tx,
      username,
      database.schema.blockFeed.schemaName,
      getTableName(database.schema.blockchains),
      ["SELECT"]
    ),
    refreshPermissionsOnTable(
      tx,
      username,
      database.schema.blockFeed.schemaName,
      getTableName(database.schema.subscriptions),
      ["SELECT", "INSERT", "UPDATE", "DELETE"]
    ),
    refreshPermissionsOnTable(
      tx,
      username,
      database.schema.blockFeed.schemaName,
      getTableName(database.schema.emailSubscriptions),
      ["SELECT", "INSERT", "UPDATE", "DELETE"]
    ),
    refreshPermissionsOnTable(
      tx,
      username,
      database.schema.blockFeed.schemaName,
      getTableName(database.schema.webhookSubscriptions),
      ["SELECT", "INSERT", "UPDATE", "DELETE"]
    ),
  ]).then(utils.throwIfError)
}
