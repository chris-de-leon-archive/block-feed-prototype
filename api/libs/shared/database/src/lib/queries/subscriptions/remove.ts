import { createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { eq, sql } from "drizzle-orm"
import { subscriptions } from "../../schema"

export type RemoveInput = Readonly<
  Pick<InferSelectModel<typeof subscriptions>, "id">
>

export const remove = async (
  db: ReturnType<typeof createClient>,
  args: RemoveInput
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(subscriptions.id.name).getSQL(),
    },
    values: {
      [subscriptions.id.name]: args.id,
    },
  }

  const query = db
    .delete(subscriptions)
    .where(eq(subscriptions.id, inputs.placeholders.id))

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
