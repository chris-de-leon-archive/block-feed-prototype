import { createClient, getPreparedStmtName } from "../../core"
import { type InferInsertModel } from "drizzle-orm"
import { subscriptions } from "../../schema"
import { sql } from "drizzle-orm"

export type CreateInput = Readonly<
  Pick<InferInsertModel<typeof subscriptions>, "name" | "userId" | "cursorId">
>

export const create = async (
  db: ReturnType<typeof createClient>,
  args: CreateInput
) => {
  const inputs = {
    placeholders: {
      cursorId: sql.placeholder(subscriptions.cursorId.name),
      userId: sql.placeholder(subscriptions.userId.name),
      name: sql.placeholder(subscriptions.name.name),
    },
    values: {
      [subscriptions.cursorId.name]: args.cursorId,
      [subscriptions.userId.name]: args.userId,
      [subscriptions.name.name]: args.name,
    },
  }

  // TODO: insert email / webhook subscription
  const query = db.insert(subscriptions).values({
    cursorId: inputs.placeholders.cursorId,
    userId: inputs.placeholders.userId,
    name: inputs.placeholders.name,
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
