import { MySqlTransaction } from "drizzle-orm/mysql-core"
import { ExtractTablesWithRelations } from "drizzle-orm"
import * as schema from "./schema"
import {
  MySql2PreparedQueryHKT,
  MySql2QueryResultHKT,
  MySql2Database,
} from "drizzle-orm/mysql2"

export type TRowOffset = Readonly<{ offset: number }>

export type TRowLimit = Readonly<{ limit: number }>

export type TDatabaseLike =
  | MySql2Database<typeof schema>
  | MySqlTransaction<
      MySql2QueryResultHKT,
      MySql2PreparedQueryHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
