import { NodePgDatabase, NodePgQueryResultHKT } from "drizzle-orm/node-postgres"
import { ExtractTablesWithRelations } from "drizzle-orm"
import { PgTransaction } from "drizzle-orm/pg-core"
import * as schema from "./schema"

export type TRowOffset = Readonly<{ offset: number }>

export type TRowLimit = Readonly<{ limit: number }>

export type TDatabaseLike =
  | NodePgDatabase<typeof schema>
  | PgTransaction<
      NodePgQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
