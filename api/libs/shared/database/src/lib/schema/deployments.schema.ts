import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { relayers } from "./relayers.schema"
import { relations } from "drizzle-orm"
import { users } from "./users.schema"
import { CONSTANTS } from "../core"
import {
  mysqlTableWithSchema,
  timestamp,
  varchar,
  unique,
} from "drizzle-orm/mysql-core"

export const deployments = mysqlTableWithSchema(
  "deployments",
  {
    id: varchar("id", {
      length: CONSTANTS.SCHEMA.SHARED.UUID_LEN,
    }).primaryKey(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    name: varchar("name", {
      length: CONSTANTS.SCHEMA.DEPLOYMENTS.MAX_NAME_LEN,
    }).notNull(),
    namespace: varchar("namespace", {
      length: CONSTANTS.SCHEMA.DEPLOYMENTS.MAX_NAMESPACE_LEN,
    }).notNull(),
    userId: varchar("user_id", { length: CONSTANTS.SCHEMA.USERS.MAX_ID_LEN })
      .references(() => users.id)
      .notNull(),
  },
  (t) => {
    return {
      uniqueDeploymentNamesPerUser: unique().on(t.userId, t.name),
    }
  },
  CONSTANTS.DATABASES.BLOCK_FEED,
)

export const deploymentRelations = relations(deployments, ({ many }) => ({
  relayers: many(relayers),
}))

export const zSelectDeploymentsSchema = createSelectSchema(deployments)

export const zInsertDeploymentsSchema = createInsertSchema(deployments)
