import { CONSTANTS } from "../core"
import {
  mysqlTableWithSchema,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core"

export const users = mysqlTableWithSchema(
  "users",
  {
    id: varchar("id", {
      length: CONSTANTS.SCHEMA.USERS.MAX_ID_LEN,
    }).primaryKey(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  undefined,
  CONSTANTS.DATABASES.BLOCK_FEED,
)
