import { timestamp, integer, jsonb, text, uuid } from "drizzle-orm/pg-core"
import { blockFeed } from "./block-feed.schema"

export const invocationLog = blockFeed.table("invocation_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  userId: text("user_id").notNull(),
  executedVersion: text("executed_version"),
  functionError: text("function_error"),
  logResult: text("log_result"),
  payload: text("payload"),
  statusCode: integer("status_code"),
  metadata: jsonb("metadata"),
})
