import { uuid, timestamp, pgSchema, text } from "drizzle-orm/pg-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { relations } from "drizzle-orm"

export const blockFeed = pgSchema("block_feed")

export const users = blockFeed.table("users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const usersRelations = relations(users, ({ many }) => {
  return {
    funcs: many(funcs),
  }
})

export const funcs = blockFeed.table("funcs", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  name: text("name").unique().notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
})

export const selectFuncsSchema = createSelectSchema(funcs)
export const insertFuncsSchema = createInsertSchema(funcs)
export const funcsRelations = relations(funcs, ({ one }) => {
  return {
    user: one(users, {
      fields: [funcs.userId],
      references: [users.id],
    }),
  }
})
