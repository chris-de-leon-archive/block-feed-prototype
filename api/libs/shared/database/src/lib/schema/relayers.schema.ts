import { mysqlRelayerTransport } from "./enums/relayer-transport.enum"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { mysqlBlockchain } from "./enums/blockchain.enum"
import { deployments } from "./deployments.schema"
import { relations } from "drizzle-orm"
import { users } from "./users.schema"
import { CONSTANTS } from "../core"
import { z } from "zod"
import {
  mysqlTableWithSchema,
  timestamp,
  varchar,
  json,
} from "drizzle-orm/mysql-core"

/**
 * A "relayer" queries blocks from a blockchain and relays it (aka sends it)
 * to some sort of destination. This destination can be an http endpoint or
 * an email inbox for example.
 *
 * Each user can create multiple relayers for a blockchain. Free tier users
 * get one relayer per chain.
 *
 */
export const relayers = mysqlTableWithSchema(
  "relayers",
  {
    id: varchar("id", {
      length: CONSTANTS.SCHEMA.SHARED.UUID_LEN,
    }).primaryKey(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    name: varchar("name", { length: CONSTANTS.SCHEMA.RELAYERS.MAX_NAME_LEN })
      .unique()
      .notNull(),
    chain: mysqlBlockchain.notNull(),
    transport: mysqlRelayerTransport.notNull(),
    options: json("options").$type<z.infer<typeof zRelayerOptions>>().notNull(),
    deploymentId: varchar("deployment_id", {
      length: CONSTANTS.SCHEMA.SHARED.UUID_LEN,
    })
      .references(() => deployments.id)
      .notNull(),
    userId: varchar("user_id", { length: CONSTANTS.SCHEMA.USERS.MAX_ID_LEN })
      .references(() => users.id)
      .notNull(),
  },
  undefined,
  CONSTANTS.DATABASES.BLOCK_FEED,
)

export const relayerRelations = relations(relayers, ({ one }) => ({
  deployment: one(deployments, {
    fields: [relayers.deploymentId],
    references: [deployments.id],
  }),
}))

export const zSelectRelayersSchema = createSelectSchema(relayers)

export const zInsertRelayersSchema = createInsertSchema(relayers)

export const zSharedOptions = z.object({
  RELAYER_REDIS_CONNECTION_URL: z.string().url(),
  RELAYER_NETWORK_URL: z.string().url(),
  RELAYER_POLL_MS: z.number().int().gte(0),
  RELAYER_REDIS_PREFIX: z.string().optional(),
})

export const zHttpOptions = zSharedOptions.extend({
  RELAYER_HTTP_URL: z.string().url(),
  RELAYER_HTTP_RETRY_DELAY_MS: z.number().int().gt(0),
  RELAYER_HTTP_MAX_RETRIES: z.number().int().gte(0),
})

export const zSmtpOptions = zSharedOptions.extend({
  RELAYER_SMTP_RECEIVER_EMAIL: z.string().email(),
  RELAYER_SMTP_SENDER_EMAIL: z.string().email(),
  RELAYER_SMTP_RETRY_DELAY_MS: z.number().int().gt(0),
  RELAYER_SMTP_MAX_RETRIES: z.number().int().gte(0),
})

export const zRelayerOptions = zHttpOptions.or(zSmtpOptions)
