import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"

export type TDatabaseCtx = Readonly<{
  database: NodePgDatabase<typeof database.schema>
}>
