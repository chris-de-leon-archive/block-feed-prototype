import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { uuid, timestamp, text } from "drizzle-orm/pg-core"
import { blockCursor } from "./block-cursor.schema"
import { blockFeed } from "./block-feed.schema"
import { relations } from "drizzle-orm"
import { users } from "./users.schema"

export const funcs = blockFeed.table("funcs", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  name: text("name").unique().notNull(),
  cursorId: text("cursor_id")
    .notNull()
    .references(() => blockCursor.id),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
})

export const funcsRelations = relations(funcs, ({ one }) => ({
  blockCursor: one(blockCursor, {
    fields: [funcs.cursorId],
    references: [blockCursor.id],
  }),
}))

export const selectFuncsSchema = createSelectSchema(funcs)
export const insertFuncsSchema = createInsertSchema(funcs)
