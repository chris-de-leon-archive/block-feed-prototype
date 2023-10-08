import { createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { subscriptions } from "../../schema"
import { and, eq, sql } from "drizzle-orm"

export type UpdateInput = Readonly<
  Pick<InferSelectModel<typeof subscriptions>, "id" | "name" | "userId">
>

export const update = async (
  db: ReturnType<typeof createClient>,
  args: UpdateInput
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(subscriptions.id.name).getSQL(),
      name: sql.placeholder(subscriptions.name.name).getSQL(),
      userId: sql.placeholder(subscriptions.userId.name).getSQL(),
    },
    values: {
      [subscriptions.id.name]: args.id,
      [subscriptions.name.name]: args.name,
      [subscriptions.userId.name]: args.userId,
    },
  }

  // TODO update email/webhook data
  const query = db
    .update(subscriptions)
    .set({
      name: inputs.placeholders.name,
    })
    .where(
      and(
        eq(subscriptions.id, inputs.placeholders.id),
        eq(subscriptions.userId, inputs.placeholders.userId)
      )
    )

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
