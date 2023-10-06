import { createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { subscriptions } from "../../schema"
import { sql } from "drizzle-orm"

export type FindOneInput = Readonly<
  Pick<InferSelectModel<typeof subscriptions>, "id" | "userId">
>

export const findOne = async (
  db: ReturnType<typeof createClient>,
  args: FindOneInput
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(subscriptions.id.name),
      userId: sql.placeholder(subscriptions.userId.name),
    },
    values: {
      [subscriptions.id.name]: args.id,
      [subscriptions.userId.name]: args.userId,
    },
  }

  const query = db.query.subscriptions.findFirst({
    where(fields, operators) {
      return operators.and(
        operators.eq(fields.id, inputs.placeholders.id),
        operators.eq(fields.userId, inputs.placeholders.userId)
      )
    },
    with: {
      // TODO: null?
      webhookSubscription: true,
      emailSubscription: true,
    },
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
